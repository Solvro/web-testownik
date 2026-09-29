import ExpoModulesCore
import ExpoUI
import WebKit

public class LibraryDragModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LibraryDrag")

    // Pages drawn under a transparent header (Wrapped) supply their own colour;
    // iOS 26 would otherwise frost the web view's top edge under the bar.
    // Shows an image (the Testownik logo) as a screen's native navigation title,
    // so it collapses from large to inline exactly like text titles do.
    Function("setNavigationTitleImage") { (title: String, image: String, height: Double, largeHeight: Double, lift: Double) in
      DispatchQueue.main.async {
        guard let logo = UIImage(named: image) else { return }
        for scene in UIApplication.shared.connectedScenes {
          guard let windows = (scene as? UIWindowScene)?.windows else { continue }
          for window in windows {
            Self.navigationItems(in: window.rootViewController, titled: title).forEach { item in
              if #available(iOS 26.0, *) {
                let attachment = NSTextAttachment(image: logo)
                let width = logo.size.width * height / max(logo.size.height, 1)
                attachment.bounds = CGRect(x: 0, y: 0, width: width, height: height)
                item.attributedTitle = AttributedString(NSAttributedString(attachment: attachment))
                // Large titles only draw text, so the large logo is the large
                // subtitle view (with an empty large title); iOS collapses it
                // into the inline title like any large title.
                if largeHeight > 0 {
                  item.largeTitle = ""
                  let logoView = UIImageView(image: logo)
                  logoView.contentMode = .scaleAspectFit
                  logoView.translatesAutoresizingMaskIntoConstraints = false
                  logoView.isAccessibilityElement = true
                  logoView.accessibilityLabel = "Testownik"
                  logoView.accessibilityTraits = .header
                  // Full width with the logo on the leading edge, where large titles sit.
                  let container = UIView()
                  container.translatesAutoresizingMaskIntoConstraints = false
                  container.addSubview(logoView)
                  let largeWidth = logo.size.width * largeHeight / max(logo.size.height, 1)
                  // The empty large title still takes its line, so the subtitle
                  // slot stays tiny and the logo rises into that line instead.
                  NSLayoutConstraint.activate([
                    logoView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                    logoView.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: lift),
                    logoView.widthAnchor.constraint(equalToConstant: largeWidth),
                    logoView.heightAnchor.constraint(equalToConstant: largeHeight),
                    container.heightAnchor.constraint(equalToConstant: 1),
                  ])
                  item.largeSubtitleView = container
                }
              }
            }
          }
        }
      }
    }

    Function("hideWebViewTopEdgeEffects") {
      DispatchQueue.main.async {
        for scene in UIApplication.shared.connectedScenes {
          guard let windows = (scene as? UIWindowScene)?.windows else { continue }
          for window in windows { Self.hideTopEdge(in: window) }
        }
      }
    }

    // SwiftUI list rows use these; the UIKit view below serves the React Native list.
    OnCreate {
      ViewModifierRegistry.register("libraryDraggable") { params, appContext, _ in
        try LibraryDraggableModifier(from: params, appContext: appContext)
      }
      ViewModifierRegistry.register("libraryDropDestination") { params, appContext, _ in
        try LibraryDropDestinationModifier(from: params, appContext: appContext)
      }
      ViewModifierRegistry.register("libraryDropZone") { params, appContext, eventDispatcher in
        try LibraryDropZoneModifier(
          from: params, appContext: appContext, eventDispatcher: eventDispatcher)
      }
    }
    OnDestroy {
      ViewModifierRegistry.unregister("libraryDraggable")
      ViewModifierRegistry.unregister("libraryDropDestination")
      ViewModifierRegistry.unregister("libraryDropZone")
    }

    View(EditorQuestionListView.self) {
      Events("onSelect", "onMove")
      Prop("rows") { (view: EditorQuestionListView, value: [[String: String]]) in view.rows = value }
      Prop("selectedId") { (view: EditorQuestionListView, value: String) in view.selectedId = value }
      Prop("editing") { (view: EditorQuestionListView, value: Bool) in view.table.setEditing(value, animated: true) }
      Prop("moveUpLabel") { (view: EditorQuestionListView, value: String) in view.moveUpLabel = value }
      Prop("moveDownLabel") { (view: EditorQuestionListView, value: String) in view.moveDownLabel = value }
    }
    View(LibraryDragView.self) {
      Events("onMove")
      Prop("itemId") { (view: LibraryDragView, value: String) in view.itemId = value }
      Prop("itemKind") { (view: LibraryDragView, value: String) in view.itemKind = value }
      Prop("itemName") { (view: LibraryDragView, value: String) in view.itemName = value }
      Prop("dragEnabled") { (view: LibraryDragView, value: Bool) in view.dragEnabled = value }
      Prop("dropEnabled") { (view: LibraryDragView, value: Bool) in view.dropEnabled = value }
    }
  }

  private static func hideTopEdge(in view: UIView) {
    if let web = view as? WKWebView {
      if #available(iOS 26.0, *) { web.scrollView.topEdgeEffect.isHidden = true }
      web.scrollView.contentInsetAdjustmentBehavior = .never
      return
    }
    for child in view.subviews { hideTopEdge(in: child) }
  }

  private static func navigationItems(in controller: UIViewController?, titled title: String) -> [UINavigationItem] {
    guard let controller else { return [] }
    var found: [UINavigationItem] = []
    // Only a tab's root screen: pushed screens (a quiz session) can share the title.
    if controller.navigationItem.title == title,
      controller.tabBarController != nil,
      controller.navigationController?.viewControllers.first === controller
    {
      found.append(controller.navigationItem)
    }
    for child in controller.children { found += navigationItems(in: child, titled: title) }
    found += navigationItems(in: controller.presentedViewController, titled: title)
    return found
  }
}
