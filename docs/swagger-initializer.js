window.onload = function() {
const DisableTryItOutPlugin = function() {return {statePlugins:{spec:{wrapSelectors:{allowTryItOutFor:() => () => false}}}}}
  //<editor-fold desc="Changeable Configuration Block">

  // the following lines will be replaced by docker/configurator, when it runs in a docker-container
  window.ui = SwaggerUIBundle({
    url: "openapi.json",
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
, DisableTryItOutPlugin
    ],
    layout: "StandaloneLayout"
  });

  //</editor-fold>
};
