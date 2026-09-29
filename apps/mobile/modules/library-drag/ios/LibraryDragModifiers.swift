import ExpoModulesCore
import ExpoUI
import SwiftUI

// A dragged row carries its web link: dropped into a text field (here or in
// another app) it becomes a link to the quiz; dropped on a folder row the app
// recognises it and moves the item.
struct LibraryDraggableModifier: ViewModifier, Record {
  @Field var url: String = ""
  @Field var enabled: Bool = true

  @ViewBuilder
  func body(content: Content) -> some View {
    if enabled, let link = URL(string: url) {
      content.draggable(link)
    } else {
      content
    }
  }
}

/// Reads a dragged library link: quizzes are /quiz/<id>, shortcuts add
/// ?shortcut=<id>, folders are /quizzes?folder=<id>.
private func libraryItem(from link: URL) -> (type: String, id: String)? {
  let parts = URLComponents(url: link, resolvingAgainstBaseURL: false)
  let query = { (name: String) in parts?.queryItems?.first { $0.name == name }?.value }
  if let shortcut = query("shortcut") { return ("shortcut", shortcut) }
  if let folder = query("folder") { return ("folder", folder) }
  let path = link.pathComponents
  if path.count >= 3, path[path.count - 2] == "quiz" { return ("quiz", path[path.count - 1]) }
  return nil
}

/// Marks a folder row as a drop target.
///
/// SwiftUI lists are collection views that don't deliver drops to rows, so a
/// hidden marker inside the row registers the list with a shared drop delegate.
/// The delegate proposes dropping *into* the hovered row (native highlight) and
/// reads the marker in that cell to learn which folder received the drop.
struct LibraryDropDestinationModifier: ViewModifier, Record {
  @Field var id: String = ""
  @Field var enabled: Bool = true

  @ViewBuilder
  func body(content: Content) -> some View {
    if enabled && !id.isEmpty {
      content.background(LibraryDropMarker(id: id))
    } else {
      content
    }
  }
}

private struct LibraryDropMarker: UIViewRepresentable {
  let id: String

  func makeUIView(context: Context) -> LibraryDropMarkerView {
    let view = LibraryDropMarkerView()
    view.isUserInteractionEnabled = false
    return view
  }

  func updateUIView(_ view: LibraryDropMarkerView, context: Context) {
    view.targetId = id
  }
}

final class LibraryDropMarkerView: UIView {
  var targetId = ""

  override func didMoveToWindow() {
    super.didMoveToWindow()
    var view = superview
    while let current = view, !(current is UICollectionView) { view = current.superview }
    if let list = view as? UICollectionView { LibraryListDrop.shared.install(on: list) }
  }
}

/// Applied to the list so drops can be reported back to JavaScript.
struct LibraryDropZoneModifier: ViewModifier, Record {
  var eventDispatcher: EventDispatcher?

  init() {}

  init(from params: Dict, appContext: AppContext, eventDispatcher: EventDispatcher) throws {
    try self = .init(from: params, appContext: appContext)
    self.eventDispatcher = eventDispatcher
  }

  func body(content: Content) -> some View {
    content.onAppear { LibraryListDrop.shared.dispatch = eventDispatcher }
  }
}

final class LibraryListDrop: NSObject, UICollectionViewDropDelegate {
  static let shared = LibraryListDrop()
  var dispatch: EventDispatcher?

  func install(on list: UICollectionView) {
    if list.dropDelegate !== self { list.dropDelegate = self }
    LibraryListDrag.shared.install(on: list)
  }

  private func target(_ list: UICollectionView, _ path: IndexPath?) -> String? {
    guard let path, let cell = list.cellForItem(at: path) else { return nil }
    return marker(in: cell)?.targetId
  }

  private func marker(in view: UIView) -> LibraryDropMarkerView? {
    if let marker = view as? LibraryDropMarkerView { return marker }
    for child in view.subviews {
      if let marker = marker(in: child) { return marker }
    }
    return nil
  }

  func collectionView(_ list: UICollectionView, canHandle session: UIDropSession) -> Bool {
    session.items.count == 1 && session.canLoadObjects(ofClass: NSURL.self)
  }

  func collectionView(
    _ list: UICollectionView, dropSessionDidUpdate session: UIDropSession,
    withDestinationIndexPath path: IndexPath?
  ) -> UICollectionViewDropProposal {
    target(list, path) == nil
      ? UICollectionViewDropProposal(operation: .forbidden)
      : UICollectionViewDropProposal(operation: .move, intent: .insertIntoDestinationIndexPath)
  }

  func collectionView(_ list: UICollectionView, performDropWith coordinator: UICollectionViewDropCoordinator) {
    guard let destination = target(list, coordinator.destinationIndexPath),
      let provider = coordinator.session.items.first?.itemProvider
    else { return }
    _ = provider.loadObject(ofClass: NSURL.self) { [weak self] object, _ in
      guard let link = object as? URL, let item = libraryItem(from: link), item.id != destination else {
        return
      }
      DispatchQueue.main.async {
        self?.dispatch?([
          "libraryDropZone": ["id": item.id, "type": item.type, "destination": destination]
        ])
      }
    }
  }
}

/// Wraps the list's own drag delegate to give lifted rows rounded corners,
/// like Files and Notes, instead of a hard-edged snapshot.
final class LibraryListDrag: NSObject, UICollectionViewDragDelegate {
  static let shared = LibraryListDrag()
  private weak var original: UICollectionViewDragDelegate?

  func install(on list: UICollectionView) {
    guard let current = list.dragDelegate, current !== self else { return }
    original = current
    list.dragDelegate = self
  }

  func collectionView(
    _ list: UICollectionView, itemsForBeginning session: UIDragSession, at path: IndexPath
  ) -> [UIDragItem] {
    original?.collectionView(list, itemsForBeginning: session, at: path) ?? []
  }

  func collectionView(_ list: UICollectionView, dragPreviewParametersForItemAt path: IndexPath)
    -> UIDragPreviewParameters?
  {
    guard let cell = list.cellForItem(at: path) else { return nil }
    let parameters = UIDragPreviewParameters()
    parameters.visiblePath = UIBezierPath(roundedRect: cell.bounds, cornerRadius: 14)
    parameters.backgroundColor = .secondarySystemGroupedBackground
    return parameters
  }

  override func responds(to selector: Selector!) -> Bool {
    super.responds(to: selector) || (original?.responds(to: selector) ?? false)
  }

  override func forwardingTarget(for selector: Selector!) -> Any? {
    original?.responds(to: selector) == true ? original : super.forwardingTarget(for: selector)
  }
}
