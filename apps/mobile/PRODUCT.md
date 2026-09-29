# Testownik mobile

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

React Native and Expo, accepted in the implementation request. Existing Django API and Next.js AI service.

## Users

Existing Testownik users studying from question banks, including PWr students.

## Product Purpose

Take Testownik study, quiz authoring, sharing, grades and profile workflows onto iOS and Android.

## Capabilities and Constraints

Preserve quiz repetition behavior across web and mobile. Offline answers survive restarts and synchronize without duplication. No provider credentials in the app. Tests use disposable data and captured email.

## Brand Commitments

Use actual Android Material 3 components through Jetpack Compose and actual iOS SwiftUI/UIKit components, including system Liquid Glass where supported. The user explicitly rejected the original uniform card/button-list UI. Retain Testownik identity with complete Polish and English copy. One primary action per task; common actions remain visible near content, with menus reserved for secondary actions. Wrapped embeds the existing web experience. Polish and English are required from the start. Refer to quizzes as quizy, never bazy.

## Accessibility & Inclusion

Scalable text, 48-point controls, system navigation, light/dark appearance and clear answer feedback.

## Required native refinement

The user rejected the first native revision despite passing interaction tests. Compare with the web quiz at phone width and with Apple Settings/App Store and Material 3 patterns. Keep all Android tab labels visible; use native search and correctly sized native toolbar actions. Reduce quiz whitespace and overflow, keep hint/explanation one tap away, and present the assistant in context. Completing a session must offer restart and history/restore, never imply a daily learning limit. Improve editor responsiveness and preserve drafts. Display account tiers accessibly in both themes. USOS OAuth sign-in and account creation belong in this release, including a real local sign-in with the user's account; synthetic fixtures do not count as that verification.

The 22 September revision is governed by IOS-REDESIGN.md. Mobile authentication uses the existing Testownik OAuth authorization server rather than the bespoke mobile JWT login. Account deletion and AI administration remain web-only.
