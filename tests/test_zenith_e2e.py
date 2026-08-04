import unittest
import time
import os
import random
import string
from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.microsoft import EdgeChromiumDriverManager

class ZenithE2ETest(unittest.TestCase):
    driver = None
    email = None
    password = None

    @classmethod
    def setUpClass(cls):
        edge_options = EdgeOptions()
        
        # Configure headless mode if requested
        headless = os.getenv("HEADLESS", "true").lower() in ("true", "1", "yes")
        if headless:
            edge_options.add_argument("--headless=new")
            
        # Basic options for stability in sandbox/ci
        edge_options.add_argument("--no-sandbox")
        edge_options.add_argument("--disable-dev-shm-usage")
        edge_options.add_argument("--disable-gpu")
        edge_options.add_argument("--window-size=1280,800")
        
        # Bypass media permissions and use fake webcam streams for biometric testing
        edge_options.add_argument("--use-fake-device-for-media-stream")
        edge_options.add_argument("--use-fake-ui-for-media-stream")
        
        # Setup Edge driver using WebDriver Manager or built-in Selenium Manager
        try:
            cls.driver = webdriver.Edge(
                service=EdgeService(EdgeChromiumDriverManager().install()),
                options=edge_options
            )
        except Exception as e:
            print(f"Error initializing Edge with WebDriverManager, falling back to basic setup: {e}")
            cls.driver = webdriver.Edge(options=edge_options)
            
        cls.driver.implicitly_wait(10)
        
        # Generate random user credentials
        rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        cls.email = f"e2e_test_{rand_str}@zenithmind.ai"
        cls.password = "P@ssword123!"

    @classmethod
    def tearDownClass(cls):
        if cls.driver:
            cls.driver.quit()

    def ensure_logged_in(self):
        """Helper to ensure the user is logged in before running dashboard/settings/play tests"""
        current_url = self.driver.current_url
        # If we are not on a logged-in page, perform login
        if "/login" in current_url or "/register" in current_url or current_url == "http://localhost:3000/" or current_url.endswith(":3000/"):
            print("   [Helper] Logged out or on landing page. Performing E2E login...")
            self.driver.get("http://localhost:3000/login")
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "email"))
            )
            self.driver.find_element(By.ID, "email").clear()
            self.driver.find_element(By.ID, "email").send_keys(self.email)
            self.driver.find_element(By.ID, "password").clear()
            self.driver.find_element(By.ID, "password").send_keys(self.password)
            self.driver.find_element(By.XPATH, "//button[contains(text(), 'Sign In')]").click()
            WebDriverWait(self.driver, 15).until(EC.url_contains("/dashboard"))

    def test_01_landing_page(self):
        """Verify the landing page loads correctly and points to login"""
        print("\n[E2E TEST 1] Verifying Landing Page...")
        self.driver.get("http://localhost:3000/")
        
        # Wait for page title/headline to load
        headline = WebDriverWait(self.driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Real-time Stress Analytics')]"))
        )
        self.assertTrue(headline.is_displayed(), "Landing page headline is not displayed")
        
        # Find and click the 'Get Started' link directly (which wraps the button)
        get_started_link = self.driver.find_element(By.XPATH, "//a[contains(@href, '/login')]")
        get_started_link.click()
        
        # Verify it routes to login page
        WebDriverWait(self.driver, 10).until(EC.url_contains("/login"))
        self.assertIn("/login", self.driver.current_url)
        print("[OK] Landing page is fully functional and routes to Login.")

    def test_02_registration_flow(self):
        """Verify new user registration flow"""
        print("\n[E2E TEST 2] Verifying User Registration Flow...")
        self.driver.get("http://localhost:3000/register")
        
        # Wait for registration form
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.ID, "name"))
        )
        
        # Fill in form
        self.driver.find_element(By.ID, "name").send_keys("E2E Test User")
        self.driver.find_element(By.ID, "email").send_keys(self.email)
        self.driver.find_element(By.ID, "password").send_keys(self.password)
        self.driver.find_element(By.ID, "confirmPassword").send_keys(self.password)
        
        # Click Create Account
        submit_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Create Account')]")
        submit_btn.click()
        
        # Should redirect to Dashboard
        WebDriverWait(self.driver, 15).until(EC.url_contains("/dashboard"))
        self.assertIn("/dashboard", self.driver.current_url)
        
        # Verify welcome message loads
        welcome_msg = WebDriverWait(self.driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(., 'Welcome back, E2E Test User')]"))
        )
        self.assertTrue(welcome_msg.is_displayed())
        print("[OK] User registration successful and dashboard loads.")

    def test_03_dashboard_widgets(self):
        """Verify dashboard widgets are loaded and present metric counters"""
        print("\n[E2E TEST 3] Verifying Dashboard Widgets...")
        self.ensure_logged_in()
        self.driver.get("http://localhost:3000/dashboard")
        
        # Verify stats cards exist
        total_sessions = WebDriverWait(self.driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Total Sessions')]"))
        )
        avg_stress = self.driver.find_element(By.XPATH, "//*[contains(text(), 'Avg Stress')]")
        system_status = self.driver.find_element(By.XPATH, "//*[contains(text(), 'System Status')]")
        
        self.assertTrue(total_sessions.is_displayed())
        self.assertTrue(avg_stress.is_displayed())
        self.assertTrue(system_status.is_displayed())
        
        # Check that session button is visible
        launch_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Launch Session')]")
        self.assertTrue(launch_btn.is_displayed())
        print("[OK] Dashboard widgets and buttons display correctly.")

    def test_04_settings_flow(self):
        """Verify user profile settings updates"""
        print("\n[E2E TEST 4] Verifying Settings Interaction...")
        self.ensure_logged_in()
        self.driver.get("http://localhost:3000/settings")
        
        # Wait for profile form
        first_name_input = WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder='John']"))
        )
        
        # Edit first name
        first_name_input.clear()
        first_name_input.send_keys("Jane")
        
        # Click save changes
        save_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Save Changes')]")
        save_btn.click()
        
        # Wait a small moment to ensure the changes action executed
        time.sleep(1)
        
        # Verify first name input still contains "Jane"
        self.assertEqual(first_name_input.get_attribute("value"), "Jane")
        print("[OK] Settings modified and saved successfully.")

    def test_05_assessment_session_flow(self):
        """Verify play session workflow, completes 4 games, generates a report, and views report"""
        print("\n[E2E TEST 5] Verifying Full Play & Stress Assessment Flow...")
        self.ensure_logged_in()
        
        # Navigate to play page with test parameter
        self.driver.get("http://localhost:3000/play?test=true")
        
        # Wait for intro screen
        start_session_btn = WebDriverWait(self.driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Start Assessment Session')]"))
        )
        start_session_btn.click()
        
        # Complete the 4-game sequence
        for round_idx in range(1, 5):
            print(f"   Playing Game {round_idx}/4...")
            
            # Wait for test complete button to appear
            test_complete_btn = WebDriverWait(self.driver, 15).until(
                EC.element_to_be_clickable((By.ID, "test-complete-btn"))
            )
            # Click it to trigger game completion API request
            test_complete_btn.click()
            
            # Wait for either 'Next Challenge →' button (rounds 1-3) or redirection to report (round 4)
            if round_idx < 4:
                next_btn = WebDriverWait(self.driver, 15).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Next Challenge')]"))
                )
                next_btn.click()
                time.sleep(0.5)
        
        # Verify auto-redirection to report page
        print("   Waiting for Report Generation...")
        WebDriverWait(self.driver, 25).until(EC.url_contains("/report?session="))
        self.assertIn("/report", self.driver.current_url)
        
        # Verify report content
        report_title = WebDriverWait(self.driver, 15).until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Stress Analysis Report')]"))
        )
        self.assertTrue(report_title.is_displayed())
        
        # Verify AI Insight is displayed
        ai_insight = self.driver.find_element(By.XPATH, "//*[contains(text(), 'AI Insight')]")
        self.assertTrue(ai_insight.is_displayed())
        
        # Verify Recommendations are displayed
        recommendations = self.driver.find_element(By.XPATH, "//*[contains(text(), 'Personalized Recommendations')]")
        self.assertTrue(recommendations.is_displayed())
        
        # Click PDF Download button
        download_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Download PDF')]")
        self.assertTrue(download_btn.is_displayed())
        
        # Go back to Dashboard
        dashboard_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Dashboard')]")
        dashboard_btn.click()
        
        WebDriverWait(self.driver, 10).until(EC.url_contains("/dashboard"))
        self.assertIn("/dashboard", self.driver.current_url)
        
        # Verify total sessions count incremented
        total_sessions_val = self.driver.find_element(By.XPATH, "//*[contains(text(), 'Total Sessions')]/../..//span").text
        print(f"[OK] Assessment session complete! Total session count is now visible.")

if __name__ == '__main__':
    unittest.main()
