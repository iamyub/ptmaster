const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 웹 빌드 시 특정 네이티브 모듈을 web-safe 버전으로 강제 해석
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // react-native/Libraries/Utilities/codegenNativeComponent 웹 스텁
    if (moduleName === 'react-native/Libraries/Utilities/codegenNativeComponent') {
      return {
        filePath: require.resolve('./web-stubs/codegenNativeComponent.js'),
        type: 'sourceFile',
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
