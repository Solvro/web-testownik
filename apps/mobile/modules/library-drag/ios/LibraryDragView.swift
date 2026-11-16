import ExpoModulesCore
import UIKit

private final class LibraryDragItem {
  let id: String
  let kind: String
  init(id: String, kind: String) { self.id = id; self.kind = kind }
}

class LibraryDragView: ExpoView, UIDragInteractionDelegate, UIDropInteractionDelegate {
  var itemId = ""
  var itemKind = ""
  var itemName = ""
  var dragEnabled = false
  var dropEnabled = false
  let onMove = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let drag = UIDragInteraction(delegate: self)
    drag.isEnabled = true
    addInteraction(drag)
    addInteraction(UIDropInteraction(delegate: self))
  }

  func dragInteraction(_ interaction: UIDragInteraction, itemsForBeginning session: UIDragSession) -> [UIDragItem] {
    guard dragEnabled, !itemId.isEmpty else { return [] }
    let item = UIDragItem(itemProvider: NSItemProvider(object: itemName as NSString))
    item.localObject = LibraryDragItem(id: itemId, kind: itemKind)
    return [item]
  }

  func dragInteraction(_ interaction: UIDragInteraction, sessionIsRestrictedToDraggingApplication session: UIDragSession) -> Bool { true }

  private func source(_ session: UIDropSession) -> LibraryDragItem? {
    guard dropEnabled, session.localDragSession != nil, session.items.count == 1,
          let item = session.items.first?.localObject as? LibraryDragItem,
          item.id != itemId else { return nil }
    return item
  }

  func dropInteraction(_ interaction: UIDropInteraction, canHandle session: UIDropSession) -> Bool { source(session) != nil }

  func dropInteraction(_ interaction: UIDropInteraction, sessionDidUpdate session: UIDropSession) -> UIDropProposal {
    let allowed = source(session) != nil
    layer.borderWidth = allowed ? 2 : 0
    layer.borderColor = tintColor.cgColor
    return UIDropProposal(operation: allowed ? .move : .cancel)
  }

  func dropInteraction(_ interaction: UIDropInteraction, performDrop session: UIDropSession) {
    layer.borderWidth = 0
    guard let item = source(session) else { return }
    onMove(["id": item.id, "type": item.kind, "destination": itemId])
  }

  func dropInteraction(_ interaction: UIDropInteraction, sessionDidExit session: UIDropSession) { layer.borderWidth = 0 }
  func dropInteraction(_ interaction: UIDropInteraction, sessionDidEnd session: UIDropSession) { layer.borderWidth = 0 }
}

// UITableView recycles cells: a large quiz only creates visible question summaries.
class EditorQuestionListView: ExpoView, UITableViewDataSource, UITableViewDelegate {
  let table = UITableView(frame: .zero, style: .insetGrouped)
  let onSelect = EventDispatcher()
  let onMove = EventDispatcher()
  var rows: [[String: String]] = [] { didSet { table.reloadData() } }
  var selectedId = "" { didSet { table.reloadData() } }
  var moveUpLabel = ""
  var moveDownLabel = ""

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    table.dataSource = self
    table.delegate = self
    table.allowsSelectionDuringEditing = true
    table.rowHeight = UITableView.automaticDimension
    table.estimatedRowHeight = 80
    table.backgroundColor = .clear
    table.register(UITableViewCell.self, forCellReuseIdentifier: "question")
    addSubview(table)
  }
  override func layoutSubviews() { super.layoutSubviews(); table.frame = bounds }
  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { rows.count }
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "question", for: indexPath)
    let row = rows[indexPath.row]
    var content = cell.defaultContentConfiguration()
    content.text = row["title"]
    content.secondaryText = row["subtitle"]
    content.secondaryTextProperties.numberOfLines = 2
    content.textProperties.font = .preferredFont(forTextStyle: .headline)
    content.secondaryTextProperties.font = .preferredFont(forTextStyle: .subheadline)
    cell.contentConfiguration = content
    cell.accessoryType = row["id"] == selectedId ? .checkmark : .none
    cell.accessibilityIdentifier = "editor-question-\(row["id"] ?? "")"
    cell.accessibilityTraits = row["id"] == selectedId ? [.button, .selected] : [.button]
    cell.accessibilityCustomActions = []
    if indexPath.row > 0 {
      cell.accessibilityCustomActions?.append(UIAccessibilityCustomAction(name: moveUpLabel) { [weak self] _ in
        self?.move(id: row["id"] ?? "", direction: -1) ?? false
      })
    }
    if indexPath.row < rows.count - 1 {
      cell.accessibilityCustomActions?.append(UIAccessibilityCustomAction(name: moveDownLabel) { [weak self] _ in
        self?.move(id: row["id"] ?? "", direction: 1) ?? false
      })
    }
    return cell
  }
  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    tableView.deselectRow(at: indexPath, animated: true)
    onSelect(["id": rows[indexPath.row]["id"] ?? ""])
  }
  func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool { true }
  func tableView(_ tableView: UITableView, editingStyleForRowAt indexPath: IndexPath) -> UITableViewCell.EditingStyle { .none }
  func tableView(_ tableView: UITableView, shouldIndentWhileEditingRowAt indexPath: IndexPath) -> Bool { false }
  func tableView(_ tableView: UITableView, moveRowAt source: IndexPath, to destination: IndexPath) {
    var reordered = rows
    let item = reordered.remove(at: source.row)
    reordered.insert(item, at: destination.row)
    // Identity-based events stay valid even if JavaScript is briefly busy.
    let before = destination.row + 1 < reordered.count ? reordered[destination.row + 1]["id"] : nil
    rows = reordered
    onMove(["id": item["id"] ?? "", "beforeId": before as Any? ?? NSNull()])
  }
  private func move(id: String, direction: Int) -> Bool {
    guard let source = rows.firstIndex(where: { $0["id"] == id }), rows.indices.contains(source + direction) else { return false }
    tableView(table, moveRowAt: IndexPath(row: source, section: 0), to: IndexPath(row: source + direction, section: 0))
    return true
  }
}

/// Installs chrome on this screen's navigation item, without searching other tabs.
final class NavigationTitleImageView: ExpoView {
  var imageName = "" { didSet { applyImage() } }
  var inlineHeight: Double = 20 { didSet { applyImage() } }
  var expandedHeight: Double = 34 { didSet { applyImage() } }
  private weak var observedItem: UINavigationItem?
  private var titleObservation: NSKeyValueObservation?
  private var appliedImage: UIImage?
  private var appliedHeights: (Double, Double)?
  private var applying = false

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      titleObservation = nil
      observedItem = nil
      appliedImage = nil
    } else { applyImage() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    applyImage()
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
      appliedImage = nil
      applyImage()
    }
  }

  private func navigationItem() -> UINavigationItem? {
    var responder: UIResponder? = self
    while let current = responder {
      if let controller = current as? UIViewController {
        var candidate: UIViewController? = controller
        while let screen = candidate {
          if screen.parent is UINavigationController {
            return screen.navigationItem
          }
          candidate = screen.parent
        }
        return nil
      }
      responder = current.next
    }
    return nil
  }

  private func applyImage() {
    guard !applying, window != nil, #available(iOS 26.0, *),
      let item = navigationItem(),
      let image = UIImage(named: imageName, in: nil, compatibleWith: traitCollection),
      inlineHeight > 0, expandedHeight > 0 else { return }
    applying = true
    defer { applying = false }
    if observedItem !== item {
      observedItem = item
      appliedImage = nil
      titleObservation = item.observe(\.title, options: [.new]) { [weak self] _, _ in
        guard let self, !self.applying, let image = self.appliedImage,
          let item = self.observedItem else { return }
        self.applying = true
        defer { self.applying = false }
        self.applyTitle(item, image: image)
      }
    }
    if appliedImage === image,
      appliedHeights?.0 == inlineHeight, appliedHeights?.1 == expandedHeight { return }
    appliedImage = image
    appliedHeights = (inlineHeight, expandedHeight)
    let ratio = image.size.width / max(image.size.height, 1)
    applyTitle(item, image: image)

    let logo = UIImageView(image: image)
    logo.contentMode = .scaleAspectFit
    logo.translatesAutoresizingMaskIntoConstraints = false
    logo.isAccessibilityElement = true
    logo.accessibilityLabel = "Testownik"
    logo.accessibilityTraits = .header
    let container = UIView()
    container.translatesAutoresizingMaskIntoConstraints = false
    container.addSubview(logo)
    NSLayoutConstraint.activate([
      logo.leadingAnchor.constraint(equalTo: container.leadingAnchor),
      logo.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -8),
      logo.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor),
      logo.widthAnchor.constraint(equalToConstant: ratio * expandedHeight),
      logo.heightAnchor.constraint(equalToConstant: expandedHeight),
      // UIKit retains its large-title line even with an empty title. Keep the
      // subtitle slot compact and draw the logo inside that existing bar area.
      container.heightAnchor.constraint(equalToConstant: 1),
    ])
    item.largeSubtitleView = container
  }

  @available(iOS 26.0, *)
  private func applyTitle(_ item: UINavigationItem, image: UIImage) {
    let attachment = NSTextAttachment(image: image)
    attachment.accessibilityLabel = "Testownik"
    attachment.bounds = CGRect(x: 0, y: 0, width: image.size.width * inlineHeight / max(image.size.height, 1), height: inlineHeight)
    item.attributedTitle = AttributedString(NSAttributedString(attachment: attachment))
    item.largeTitle = ""
  }
}
