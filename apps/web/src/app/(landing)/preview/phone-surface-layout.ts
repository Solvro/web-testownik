/**
 * The app's components pick their layout from the viewport (`sm:`, `md:`). A
 * phone drawn on the page is phone-sized whatever the viewport says, so on a
 * tablet the CSS phone's dialogs would lay out for a tablet. These variants go
 * on the phone screen's root and put the phone layout back from outside,
 * keyed on the components' `data-slot` hooks; the shared components stay as
 * they are in the app. Each line undoes what the viewport adds.
 *
 * They only reach what renders inside the root, so the screen's overlays have
 * to portal into it (`PreviewSandbox` gives a phone its own portal layer).
 */
export const PHONE_SURFACE_LAYOUT = [
  // Inputs below 16px make iOS zoom in on focus (`Input` is `md:text-sm`).
  "[&_[data-slot=dialog-content]_input]:text-base",
  // `DialogFooter` stacks its buttons on a phone (`sm:flex-row`).
  "[&_[data-slot=dialog-footer]]:flex-col-reverse [&_[data-slot=dialog-footer]]:justify-normal",
  // `SettingsForm` puts each label beside its control from `md:`.
  "[&_[data-slot=settings-form-row]]:flex-col [&_[data-slot=settings-form-row]>div]:justify-start",
  // `ShareQuizDialog`: the access levels share one wrapping row of equal
  // tiles, and the footer keeps its phone order (full-width actions, the
  // copy link as a text button underneath).
  "[&_[data-slot=access-level-selector]]:flex-wrap",
  "[&_[data-slot=access-level-selector]>button]:min-w-0 [&_[data-slot=access-level-selector]>button]:flex-1 [&_[data-slot=access-level-selector]>button]:basis-0 [&_[data-slot=access-level-selector]>button]:px-2",
  "[&_[data-slot=access-level-selector]_svg]:size-5",
  "[&_[data-slot=access-level-selector]_span]:w-full [&_[data-slot=access-level-selector]_span]:text-xs [&_[data-slot=access-level-selector]_span]:whitespace-nowrap",
  "[&_[data-slot=dialog-footer]>[data-slot=button]:has(+[data-slot=share-quiz-actions])]:hidden",
  "[&_[data-slot=share-quiz-actions]>*]:w-full",
  "[&_[data-slot=share-quiz-actions]+[data-slot=button]]:inline-flex",
].join(" ");
