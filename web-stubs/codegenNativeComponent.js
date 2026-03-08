/**
 * 웹 빌드용 codegenNativeComponent 스텁
 * react-native-screens의 네이티브 컴포넌트가 웹에서 불필요한 네이티브 API를
 * 호출하는 것을 방지합니다. Web에서는 react-native-screens의 .web.js 파일이
 * 사용되므로 이 스텁은 실제로 실행되지 않습니다.
 */
const { View } = require('react-native');

function codegenNativeComponent(componentName, options) {
  return View;
}

module.exports = codegenNativeComponent;
module.exports.default = codegenNativeComponent;
