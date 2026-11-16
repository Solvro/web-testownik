import ExpoModulesCore
import ExpoUI
import WebKit

public class LibraryDragModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LibraryDrag")

    // Pages under a transparent header supply their own edge colour.
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

    View(NavigationTitleImageView.self) {
      Prop("imageName") { (view: NavigationTitleImageView, value: String) in view.imageName = value }
      Prop("inlineHeight") { (view: NavigationTitleImageView, value: Double) in view.inlineHeight = value }
      Prop("expandedHeight") { (view: NavigationTitleImageView, value: Double) in view.expandedHeight = value }
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

}
