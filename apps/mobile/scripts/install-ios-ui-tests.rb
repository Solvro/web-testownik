# Run after `expo prebuild --platform ios` with the Ruby environment used by CocoaPods.
# This modifies only the generated, gitignored Xcode project.
require 'xcodeproj'

root = File.expand_path('..', __dir__)
project_path = File.join(root, 'ios/Testownik.xcodeproj')
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'Testownik' }
abort 'Testownik app target not found; run Expo prebuild first.' unless app
name = 'TestownikUITests'
target = project.targets.find { |candidate| candidate.name == name }
unless target
  target = project.new_target(:ui_test_bundle, name, :ios, '16.4')
  target.add_dependency(app)
  group = project.main_group.new_group(name)
  source = group.new_file('../e2e/ios/NativeFlows.swift')
  target.source_build_phase.add_file_reference(source)
end
target.build_configurations.each do |config|
  config.build_settings.merge!({
      'PRODUCT_BUNDLE_IDENTIFIER' => 'pl.solvro.testownik.uitests',
      'PRODUCT_NAME' => name,
      'MACH_O_TYPE' => 'mh_bundle',
      'WRAPPER_EXTENSION' => 'xctest',
      'GENERATE_INFOPLIST_FILE' => 'YES',
      'SWIFT_VERSION' => '5.0',
      'TEST_TARGET_NAME' => 'Testownik',
      'TARGETED_DEVICE_FAMILY' => '1,2',
      'CODE_SIGNING_ALLOWED' => 'YES',
      'CODE_SIGN_IDENTITY[sdk=iphonesimulator*]' => '-'
  })
end
project.root_object.attributes['TargetAttributes'] ||= {}
project.root_object.attributes['TargetAttributes'][target.uuid] = { 'TestTargetID' => app.uuid }
project.save
scheme_path = File.join(project_path, 'xcshareddata/xcschemes/Testownik.xcscheme')
scheme = Xcodeproj::XCScheme.new(scheme_path)
unless scheme.test_action.testables.any? { |testable| testable.buildable_references.any? { |ref| ref.xml_element.attributes['BlueprintIdentifier'] == target.uuid } }
  scheme.add_test_target(target)
  scheme.save_as(project_path, 'Testownik')
end
puts 'Native iOS smoke tests installed in the generated project.'
