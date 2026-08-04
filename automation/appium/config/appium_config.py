import os

DESIRED_CAPABILITIES = {
    "platformName": "Android",
    "automationName": "UiAutomator2",
    "deviceName": "Android Emulator",
    "app": os.path.abspath("build/outputs/apk/debug/app-debug.apk"),
    "appPackage": "com.pdd.stressanalyser",
    "appActivity": ".MainActivity",
    "noReset": False
}

APPIUM_SERVER_URL = "http://127.0.0.1:4723/wd/hub"
