import XCTest

final class DonnaHomeViewUITests: XCTestCase {
    func testLaunchShowsUnconfiguredWorkspace() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.staticTexts["Donna for iOS"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Cloudflare setup is not available yet."].exists)
    }
}
