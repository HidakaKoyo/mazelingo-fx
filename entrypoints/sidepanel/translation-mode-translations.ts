export const translationModeTranslations = {
  en: {
    localEndpointHint:
      "For an OpenAI-compatible server. Enter local/<model ID> under Custom… in the model chain. Requests use /chat/completions.",
    plamoModeHint:
      "PLaMo sends translation requests to /completions on the local endpoint. Links and emphasis are not preserved in translated text.",
    plamoModel: "PLaMo model ID",
    translationMode: "Translation mode",
    translationModeModelChain: "Model chain",
    translationModePlamo: "PLaMo",
  },
  ja: {
    localEndpointHint:
      "OpenAI互換サーバー用です。モデルチェーンの「カスタム…」へlocal/<モデルID>を入力します。要求は/chat/completionsへ送ります",
    plamoModeHint:
      "PLaMoはローカル接続先の/completionsへ翻訳要求を送ります。訳文のリンクや強調は残りません。",
    plamoModel: "PLaMoのモデルID",
    translationMode: "翻訳モード",
    translationModeModelChain: "モデルチェーン",
    translationModePlamo: "PLaMo",
  },
};
