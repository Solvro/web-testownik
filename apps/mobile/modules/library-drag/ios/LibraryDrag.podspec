Pod::Spec.new do |s|
  s.name           = 'LibraryDrag'
  s.version        = '1.0.0'
  s.summary        = 'Native library drag and drop'
  s.description    = 'Local UIKit and SwiftUI drag and drop for Testownik library rows.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
