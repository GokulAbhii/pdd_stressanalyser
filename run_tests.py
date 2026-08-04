import os
import sys
import subprocess
import time
import urllib.request
import urllib.error
import socket
import unittest

def check_port_open(host, port):
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except (socket.timeout, ConnectionRefusedError):
        return False

def wait_for_service(url, name, timeout=35):
    print(f"Waiting for {name} to be ready at {url}...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    print(f"[OK] {name} is ready!")
                    return True
        except Exception:
            pass
        time.sleep(1)
    print(f"[FAIL] Timeout waiting for {name}.")
    return False

def wait_for_port(host, port, name, timeout=35):
    print(f"Waiting for {name} port {port} to open...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        if check_port_open(host, port):
            print(f"[OK] {name} is listening on port {port}!")
            return True
        time.sleep(1)
    print(f"[FAIL] Timeout waiting for {name} port {port}.")
    return False

def print_log_file(path, name):
    if os.path.exists(path):
        print(f"\n--- {name} LOGS ---")
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                print(f.read())
        except Exception as e:
            print(f"Failed to read logs: {e}")
        print("---------------------\n")

def main():
    # 1. Prepend portable Node.js path to environment PATH
    env = os.environ.copy()
    node_dir = r"c:\Users\abhix\ZenithAI\node-portable\node-v20.11.0-win-x64"
    if os.path.exists(node_dir):
        env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
        print(f"Prepended portable Node.js path to PATH environment variable.")
    else:
        print("WARNING: Portable Node.js directory not found. Using system-wide node/npm.")

    backend_proc = None
    frontend_proc = None
    
    # Ensure logs directory exists
    os.makedirs("tests/logs", exist_ok=True)
    backend_log_path = "tests/logs/backend.log"
    frontend_log_path = "tests/logs/frontend.log"

    try:
        # 2. Start Backend API Server
        print("Starting Backend API (FastAPI) on port 8000...")
        python_exe = os.path.abspath(r"apps/api/venv/Scripts/python.exe")
        if not os.path.exists(python_exe):
            print("ERROR: Python virtual environment not found in apps/api/venv.")
            sys.exit(1)

        # Redirect output to file to prevent process blocking
        backend_log = open(backend_log_path, "w", encoding="utf-8", errors="ignore")
        backend_proc = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "app.main:app", "--port", "8000", "--host", "127.0.0.1"],
            cwd="apps/api",
            stdout=backend_log,
            stderr=backend_log
        )

        # 3. Start Frontend Next.js Dev Server
        print("Starting Frontend (Next.js) on port 3000...")
        frontend_log = open(frontend_log_path, "w", encoding="utf-8", errors="ignore")
        frontend_proc = subprocess.Popen(
            ["npm.cmd", "run", "dev", "--", "-p", "3000"],
            cwd="apps/web",
            env=env,
            shell=True,
            stdout=frontend_log,
            stderr=frontend_log
        )

        # 4. Wait for both servers to be ready
        backend_ready = wait_for_service("http://127.0.0.1:8000/health", "Backend API")
        frontend_ready = wait_for_port("127.0.0.1", 3000, "Frontend Next.js")

        # Close log files to flush writes
        backend_log.close()
        frontend_log.close()

        if not backend_ready or not frontend_ready:
            print("\nERROR: Servers failed to start properly.")
            print_log_file(backend_log_path, "BACKEND")
            print_log_file(frontend_log_path, "FRONTEND")
            sys.exit(1)

        # 5. Discover and run the Selenium E2E Tests
        print("\n==================================================")
        print("RUNNING AUTOMATED E2E SELENIUM TEST SUITE")
        print("==================================================\n")
        
        loader = unittest.TestLoader()
        sys.path.insert(0, os.path.abspath("tests"))
        from test_zenith_e2e import ZenithE2ETest
        
        suite = loader.loadTestsFromTestCase(ZenithE2ETest)
        runner = unittest.TextTestRunner(verbosity=2)
        result = runner.run(suite)

        # 6. Print report of passed/failed tests
        total = result.testsRun
        failures = len(result.failures)
        errors = len(result.errors)
        passed = total - failures - errors

        print("\n==================================================")
        print("ZENITHAI AUTOMATED SELENIUM TEST RESULTS REPORT")
        print("==================================================")
        print(f"  Total Test Cases Checked:  {total}")
        print(f"  Passed Test Cases:         {passed}   [OK]")
        print(f"  Failed Test Cases:         {failures}   [FAIL]")
        print(f"  Errors Encountered:        {errors}   [ERROR] ")
        print("==================================================")
        
        if failures > 0 or errors > 0:
            print("  STATUS: FAIL")
            sys.exit(1)
        else:
            print("  STATUS: SUCCESS (All functions work!)")
            sys.exit(0)

    except KeyboardInterrupt:
        print("\nTest execution interrupted by user.")
    finally:
        # 7. Clean up background processes
        print("\nShutting down background services...")
        if backend_proc:
            print("Stopping Backend process...")
            backend_proc.terminate()
            try:
                backend_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                backend_proc.kill()
        
        if frontend_proc:
            print("Stopping Frontend process...")
            try:
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], 
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                frontend_proc.terminate()
                try:
                    frontend_proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    frontend_proc.kill()
        print("Done. All services stopped.")

if __name__ == "__main__":
    main()
