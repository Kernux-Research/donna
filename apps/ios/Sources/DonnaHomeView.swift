import SwiftUI

struct DonnaHomeView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.largeTitle)
                .accessibilityHidden(true)

            Text("Donna for iOS")
                .font(.title)

            Text("Cloudflare setup is not available yet.")
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
        .padding()
    }
}
