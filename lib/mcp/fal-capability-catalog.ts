/**
 * Curated fal route catalog (73 runners). Generated from
 * runner-app-examples/api-proxy/deployments/local-offchain-flux/generated/runners.json
 * — regenerate when that file changes.
 */

export type FalCapabilityCatalogEntry = {
  name: string;
  label: string;
  endpointId: string;
  provider: string;
  schemaSha256: string;
  transport: string;
  priceUsd: number | null;
};

export const FAL_CAPABILITY_CATALOG: readonly FalCapabilityCatalogEntry[] = [
  {
    "name": "livepeer-example/fal-bernini-r-edit",
    "label": "fal-bernini-r-edit",
    "endpointId": "fal-ai/bernini-r/edit-video",
    "provider": "fal",
    "schemaSha256": "50ce57522a18a92cd0b22f8fcf10a58217761294a69ca3df7af4a73e1ac32b87",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-bg-remove",
    "label": "fal-bg-remove",
    "endpointId": "fal-ai/birefnet",
    "provider": "fal",
    "schemaSha256": "d67b3cba3adfd498b568d9aaf8fd1a2f616bb352bee4d7ad117eaf5a728f9823",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-compose",
    "label": "fal-ffmpeg-compose",
    "endpointId": "fal-ai/ffmpeg-api/compose",
    "provider": "fal",
    "schemaSha256": "e0dd992d00085ee3e736377bf386db74f07e99d39ddaa8af84630ce4b47abb99",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-extract-frame",
    "label": "fal-ffmpeg-extract-frame",
    "endpointId": "fal-ai/ffmpeg-api/extract-frame",
    "provider": "fal",
    "schemaSha256": "d6216c264b359a90a1c50f064bbafb61ba1fc442b25b3412d1fb25531c65ce97",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-images-to-video",
    "label": "fal-ffmpeg-images-to-video",
    "endpointId": "fal-ai/ffmpeg-api/images-to-video",
    "provider": "fal",
    "schemaSha256": "f3a77b1ca114dd7f425943863280868bc83662704c9f1a3cafde6f11855e870d",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-loudnorm",
    "label": "fal-ffmpeg-loudnorm",
    "endpointId": "fal-ai/ffmpeg-api/loudnorm",
    "provider": "fal",
    "schemaSha256": "cbcb46f7d48c1a3466849cddc14989552fc05e463932c640eaf21361c9800aba",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-merge-audio-video",
    "label": "fal-ffmpeg-merge-audio-video",
    "endpointId": "fal-ai/ffmpeg-api/merge-audio-video",
    "provider": "fal",
    "schemaSha256": "f2c0e959e38518ad38c442870e17f1ddffb408f3b26bfc5897328c6c48452c00",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-merge-videos",
    "label": "fal-ffmpeg-merge-videos",
    "endpointId": "fal-ai/ffmpeg-api/merge-videos",
    "provider": "fal",
    "schemaSha256": "c2b2396565f4b404fbafeeab5221fd9eb4bdfe9673072bd51691ca7567639141",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-metadata",
    "label": "fal-ffmpeg-metadata",
    "endpointId": "fal-ai/ffmpeg-api/metadata",
    "provider": "fal",
    "schemaSha256": "6a0ea851c4da847e88cffc675627ea6f92be2cefd3a7a6f3224bf78be94d4e0c",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-scale-video",
    "label": "fal-ffmpeg-scale-video",
    "endpointId": "fal-ai/workflow-utilities/scale-video",
    "provider": "fal",
    "schemaSha256": "bff043dca8cd9f4b47e8af42b299936b07e764c8f7b3c4eea32e15f10a0570fc",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ffmpeg-trim-video",
    "label": "fal-ffmpeg-trim-video",
    "endpointId": "fal-ai/workflow-utilities/trim-video",
    "provider": "fal",
    "schemaSha256": "1eb55e5ad3e4335c49e4e27c3488cc2fe18d998b5d20f3f9dc5bbb92f42d4942",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-2-edit",
    "label": "fal-flux-2-edit",
    "endpointId": "fal-ai/flux-2/edit",
    "provider": "fal",
    "schemaSha256": "0d85797f0ec03f738115e07da4511ab9d1fe41ef8813b80a200e70d6f3816a2a",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-2-pro",
    "label": "fal-flux-2-pro",
    "endpointId": "fal-ai/flux-2-pro",
    "provider": "fal",
    "schemaSha256": "8004a03b90297a34d3e46f0af876f037fa815336699adb7cdf9dc542ba3a45de",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-3-extend",
    "label": "fal-flux-3-extend",
    "endpointId": "blackforestlabs/flux-3/extend-video",
    "provider": "fal",
    "schemaSha256": "59d6ee45e70ee3f50b5e8d2f55801086ab56ee6a04ce606b0ae2ffbdaf93e982",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-3-i2v",
    "label": "fal-flux-3-i2v",
    "endpointId": "blackforestlabs/flux-3/image-to-video",
    "provider": "fal",
    "schemaSha256": "36c95aa7163037ff1c19457e6e437155d921495185d2655698595aeafe998682",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-3-keyframes",
    "label": "fal-flux-3-keyframes",
    "endpointId": "blackforestlabs/flux-3/keyframes-to-video",
    "provider": "fal",
    "schemaSha256": "19b08c5d80003b10a28a93ea39a62e80c26532d05b0034fcc9e41b37299cb5a7",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-3-t2v",
    "label": "fal-flux-3-t2v",
    "endpointId": "blackforestlabs/flux-3/text-to-video",
    "provider": "fal",
    "schemaSha256": "671c513df2c8cbd771ca676d235e40e321dae327558f3f71d0b606b1b86493a6",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-3-transition",
    "label": "fal-flux-3-transition",
    "endpointId": "blackforestlabs/flux-3/first-last-frame-to-video",
    "provider": "fal",
    "schemaSha256": "e038e79cce3edb3b4363e7d8b61d24a3609e83541568d06e3dc2f16fa64e0cb8",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-erase",
    "label": "fal-flux-erase",
    "endpointId": "fal-ai/flux-pro/v1/erase",
    "provider": "fal",
    "schemaSha256": "422fa1b28027aff5b2673f1231fa68facea71bac7d24d7f02242df294455af4d",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-fill",
    "label": "fal-flux-fill",
    "endpointId": "fal-ai/flux-pro/v1/fill",
    "provider": "fal",
    "schemaSha256": "78fb1496e170f2bca91eae17791ad65eea25738c812b8229733eb01a40c08907",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-schnell",
    "label": "fal-flux-schnell",
    "endpointId": "fal-ai/flux/schnell",
    "provider": "fal",
    "schemaSha256": "6a5103a47bb61b39ffadcc8f6ea6f98d1027cc8ba14d1723883dd6c4a6a06658",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-flux-video-upscale",
    "label": "fal-flux-video-upscale",
    "endpointId": "blackforestlabs/flux-video-upscale",
    "provider": "fal",
    "schemaSha256": "caf4c7410c6cd52c7f9a9af7cac11373370b05c0b3d107b349ed2205b1096f31",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-gemini-tts",
    "label": "fal-gemini-tts",
    "endpointId": "fal-ai/gemini-3.1-flash-tts",
    "provider": "fal",
    "schemaSha256": "43aefb19c6f3a9d205a733d0c79672dec2ead28826c19b964310d663b677b502",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-gpt-image-2",
    "label": "fal-gpt-image-2",
    "endpointId": "openai/gpt-image-2",
    "provider": "fal",
    "schemaSha256": "03e41db91e4e99678848c0312a2c302349d3f78a85c43cce84996b8f332dfcb4",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-gpt-image-2-edit",
    "label": "fal-gpt-image-2-edit",
    "endpointId": "openai/gpt-image-2/edit",
    "provider": "fal",
    "schemaSha256": "ffef180c58f5af0e99f7aad58de9a338ba7cedf95706397557aa1328e81ec123",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-grok-image-2",
    "label": "fal-grok-image-2",
    "endpointId": "xai/grok-imagine-image/v2.0/text-to-image",
    "provider": "fal",
    "schemaSha256": "ccb9a3c4082af2f27196cedb3cdf2e5c2aeba4d8a374b67a134b7a6d092fd563",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-grok-image-2-edit",
    "label": "fal-grok-image-2-edit",
    "endpointId": "xai/grok-imagine-image/v2.0/edit",
    "provider": "fal",
    "schemaSha256": "b12a1a9c2c1c13e53bce89a4d5720d4b8d849cb01ab26238d57f29fcc0972ef0",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-grok-imagine-video-15-i2v",
    "label": "fal-grok-imagine-video-15-i2v",
    "endpointId": "xai/grok-imagine-video/v1.5/image-to-video",
    "provider": "fal",
    "schemaSha256": "6691ab92e9cc3b83bdcb67d990407dbea7e3f3344bf70bd35c01c359f2433b8a",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-grok-imagine-video-15-ref2v",
    "label": "fal-grok-imagine-video-15-ref2v",
    "endpointId": "xai/grok-imagine-video/v1.5/reference-to-video",
    "provider": "fal",
    "schemaSha256": "dc451bf0f09e9f16ceb72e3ba545ea2ba1ddca694b4a86eeed758e54e09885b0",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-grok-imagine-video-15-t2v",
    "label": "fal-grok-imagine-video-15-t2v",
    "endpointId": "xai/grok-imagine-video/v1.5/text-to-video",
    "provider": "fal",
    "schemaSha256": "48b12b52911f2be1738f83a9a48ed42811c390dbb881093e2d592dc74edbd0e0",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ideogram-v4",
    "label": "fal-ideogram-v4",
    "endpointId": "ideogram/v4",
    "provider": "fal",
    "schemaSha256": "f20f37457fb45154eeebd6692274f5473964500bd75d03b19e4057538d528727",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-kling-o3-ref2v",
    "label": "fal-kling-o3-ref2v",
    "endpointId": "fal-ai/kling-video/o3/standard/reference-to-video",
    "provider": "fal",
    "schemaSha256": "cf16690a8899e76eb532f3051ec94f6e6723cf26ae4c09dd7699c432a2af415a",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-kling-v3-pro-i2v",
    "label": "fal-kling-v3-pro-i2v",
    "endpointId": "fal-ai/kling-video/v3/pro/image-to-video",
    "provider": "fal",
    "schemaSha256": "33ca087d756cd1f8c1e6101501c95ab287599d1566c23f0102611588cfbf532b",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-kling-v3-pro-t2v",
    "label": "fal-kling-v3-pro-t2v",
    "endpointId": "fal-ai/kling-video/v3/pro/text-to-video",
    "provider": "fal",
    "schemaSha256": "16f3ccdf1edc1010af12e2888162e00edc66f0c39999cfb88e1eb298b9c71d82",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ltx-25-a2v-pro",
    "label": "fal-ltx-25-a2v-pro",
    "endpointId": "lightricks/ltx-2.5/audio-to-video/pro",
    "provider": "fal",
    "schemaSha256": "367df86faab2efa18200b2f7133f276be0e3b6bbdcca684c5ca6fd6b85025425",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ltx-25-i2v-fast",
    "label": "fal-ltx-25-i2v-fast",
    "endpointId": "lightricks/ltx-2.5/image-to-video/fast",
    "provider": "fal",
    "schemaSha256": "e3fbfbffa21f3c785fc336701558995af2fd7d7ee6a56fb553ec794fb5001e58",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ltx-25-i2v-pro",
    "label": "fal-ltx-25-i2v-pro",
    "endpointId": "lightricks/ltx-2.5/image-to-video/pro",
    "provider": "fal",
    "schemaSha256": "405296a9181f79f50295ffb9f2b18905a37aee75ae5ee9d8eb328492cc0f32e0",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ltx-25-t2v-fast",
    "label": "fal-ltx-25-t2v-fast",
    "endpointId": "lightricks/ltx-2.5/text-to-video/fast",
    "provider": "fal",
    "schemaSha256": "1a5d4ad33c76bd102f344f69bb474b687fd7d1e9b531c61303c6376fea4f30de",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ltx-25-t2v-pro",
    "label": "fal-ltx-25-t2v-pro",
    "endpointId": "lightricks/ltx-2.5/text-to-video/pro",
    "provider": "fal",
    "schemaSha256": "5367453552de4127886297931fc6964a06d298a825bf2fb9bad76fac67fab06b",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-marlin-video",
    "label": "fal-marlin-video",
    "endpointId": "fal-ai/marlin",
    "provider": "fal",
    "schemaSha256": "12b5fd65f9784fbfc86b1a79a75c907ee32781617344d4b04dbdbabf738e2c0f",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-meshy-v7-i3d",
    "label": "fal-meshy-v7-i3d",
    "endpointId": "meshy/v7/image-to-3d",
    "provider": "fal",
    "schemaSha256": "d3f05ecfc5b7f58760d46a65c393617ab0f4c17e8989ef7ea834109f52d7964c",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-minimax-h3-max-i2v",
    "label": "fal-minimax-h3-max-i2v",
    "endpointId": "minimax/h3-max/image-to-video",
    "provider": "fal",
    "schemaSha256": "72208ac77df8358b16614ddc7fcac6dd6a86f195df1d420d4282e0fb916e2c4d",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-minimax-h3-max-ref2v",
    "label": "fal-minimax-h3-max-ref2v",
    "endpointId": "minimax/h3-max/reference-to-video",
    "provider": "fal",
    "schemaSha256": "507bc3faf6808b2a7e3ecfea8556cf68454fb6fa55a0bb7de2b0bcfbf6265835",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-minimax-h3-max-t2v",
    "label": "fal-minimax-h3-max-t2v",
    "endpointId": "minimax/h3-max/text-to-video",
    "provider": "fal",
    "schemaSha256": "ebeb4901645bfcd826dc701e365e7a775c61d505e080d54c4aa84b1163e8ee59",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-minimax-music-3",
    "label": "fal-minimax-music-3",
    "endpointId": "minimax/music-3",
    "provider": "fal",
    "schemaSha256": "74fdeab613ee051bf59dbdee9105d4a9bfd606e7035d0ae089215c844c3f44fc",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-mirelo-sfx",
    "label": "fal-mirelo-sfx",
    "endpointId": "Mirelo-AI/sfx1.6/text-to-audio",
    "provider": "fal",
    "schemaSha256": "c40effb4fb71bb60969db97183a1b73dc105739b8fa421aaa5e0ab9061c84724",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-mmaudio-v2-video-soundtrack",
    "label": "fal-mmaudio-v2-video-soundtrack",
    "endpointId": "fal-ai/mmaudio-v2",
    "provider": "fal",
    "schemaSha256": "31d21a6cca811b80f5f21536634ea9d045c7cb7f67dd8e7ab2e8c2baf734cbf2",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-nemotron-asr",
    "label": "fal-nemotron-asr",
    "endpointId": "nvidia/nemotron-asr-multilingual/asr",
    "provider": "fal",
    "schemaSha256": "c5fbd66df007023e654449ab67acb89b325aae608ec8381674264d2e91bfbd9c",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-pixelcut-video-bg-remove",
    "label": "fal-pixelcut-video-bg-remove",
    "endpointId": "Pixelcut/video-background-removal",
    "provider": "fal",
    "schemaSha256": "a486105bc4a5e16cd86991488727e2dd2cabd9ab26860b4662fc69eb7253e304",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ray-32-i2v",
    "label": "fal-ray-32-i2v",
    "endpointId": "luma/agent/ray/v3.2/image-to-video",
    "provider": "fal",
    "schemaSha256": "42a80ca672f3ead829c65142c2ab2974d74f5091d0b6228a0d654cd2818bd9e5",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ray-32-reframe",
    "label": "fal-ray-32-reframe",
    "endpointId": "luma/agent/ray/v3.2/reframe",
    "provider": "fal",
    "schemaSha256": "16afead8676037019adeb51f322e5585ef8c0b32e8841f076c38309b07a6c389",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ray-32-t2v",
    "label": "fal-ray-32-t2v",
    "endpointId": "luma/agent/ray/v3.2/text-to-video",
    "provider": "fal",
    "schemaSha256": "b92c339a52874ebd859ad89919159f2a6365dad20966f563ae2ae344f523ee96",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-ray-32-v2v",
    "label": "fal-ray-32-v2v",
    "endpointId": "luma/agent/ray/v3.2/video-to-video",
    "provider": "fal",
    "schemaSha256": "30dc4e45a5061f02b6ae4f2402a3a8cdeb1b7efe9aa2b63885a37100b70fcaf0",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-recraft-v4",
    "label": "fal-recraft-v4",
    "endpointId": "fal-ai/recraft/v4/pro/text-to-image",
    "provider": "fal",
    "schemaSha256": "fa2cbd66c51d31e89da0fb218c69a1711061e84df393c9bdfe7372fa9cb0968f",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedance-20-i2v",
    "label": "fal-seedance-20-i2v",
    "endpointId": "bytedance/seedance-2.0/image-to-video",
    "provider": "fal",
    "schemaSha256": "d32472a295d83282dc844b8c34e43147b615d4e9c3d31c3c3e753ba1d5184224",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedance-20-ref2v",
    "label": "fal-seedance-20-ref2v",
    "endpointId": "bytedance/seedance-2.0/reference-to-video",
    "provider": "fal",
    "schemaSha256": "7fe52abf70856fad3666ffc15f7aa7ae89d193bcc24319c1db8ab8c63e4b1257",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedance-20-t2v",
    "label": "fal-seedance-20-t2v",
    "endpointId": "bytedance/seedance-2.0/text-to-video",
    "provider": "fal",
    "schemaSha256": "1d4b35446f5597c020816e6f1924c19cebbd8a6773aea3e5595c98894d01c84d",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedance-25-i2v",
    "label": "fal-seedance-25-i2v",
    "endpointId": "bytedance/seedance-2.5/image-to-video",
    "provider": "fal",
    "schemaSha256": "eb8544f6ad89e54d9411dc1ac0e72aea82c72ae72a7eb1069c0f605d4d777f62",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedance-25-ref2v",
    "label": "fal-seedance-25-ref2v",
    "endpointId": "bytedance/seedance-2.5/reference-to-video",
    "provider": "fal",
    "schemaSha256": "d09f8fcc3fafc6120df0f78aba951ea2906e147268fe26a6ab70189b5f874c03",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedance-25-t2v",
    "label": "fal-seedance-25-t2v",
    "endpointId": "bytedance/seedance-2.5/text-to-video",
    "provider": "fal",
    "schemaSha256": "5deddbc53121eb84531dc576f2ac5fafc319011dfac373e205e994be91d67f5a",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedream-5-pro",
    "label": "fal-seedream-5-pro",
    "endpointId": "bytedance/seedream/v5/pro/text-to-image",
    "provider": "fal",
    "schemaSha256": "bef86ecc21f8936e1ce0e96a6b1fca3b75d6e0e969662557743b6d5619a8331e",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-seedream-5-pro-edit",
    "label": "fal-seedream-5-pro-edit",
    "endpointId": "bytedance/seedream/v5/pro/edit",
    "provider": "fal",
    "schemaSha256": "41f3b15ecf42b1e222f6336a9eb50abf9f31a789382a28a68c49b069af0c3b23",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-sonilo-v2m",
    "label": "fal-sonilo-v2m",
    "endpointId": "sonilo/v1.1/video-to-music",
    "provider": "fal",
    "schemaSha256": "ef01b074fdb9160aeafdfe1e6f0118757fae5d6c3c45fe0a38331e8ef9cbf5e8",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-subtitles-veed",
    "label": "fal-subtitles-veed",
    "endpointId": "veed/subtitles",
    "provider": "fal",
    "schemaSha256": "e9f816206d57cfefeafa90b880a9c72ed98db8c53777071a2e7534d432b3fd1b",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-sync-lipsync-v3",
    "label": "fal-sync-lipsync-v3",
    "endpointId": "fal-ai/sync-lipsync/v3/image-to-video",
    "provider": "fal",
    "schemaSha256": "6132b31e307224237c261327dced31cd5a1a204b731ea49987fe044ef4fd2040",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-talking-head",
    "label": "fal-talking-head",
    "endpointId": "fal-ai/bytedance/omnihuman/v1.5",
    "provider": "fal",
    "schemaSha256": "797e650ec127c941815ae0efa523b6df071578e753bf9ef5d4f56d85ad010dc0",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-topaz-image-upscale",
    "label": "fal-topaz-image-upscale",
    "endpointId": "topaz/upscale/image/precision",
    "provider": "fal",
    "schemaSha256": "77c940126cd211765f75e51695b98a3339fc75c9feeb7b726b8a79fa05fb495b",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-tripo-h31-t3d",
    "label": "fal-tripo-h31-t3d",
    "endpointId": "tripo3d/h3.1/text-to-3d",
    "provider": "fal",
    "schemaSha256": "cdf5dd9cf7a706cddb233d46b85a3bf4de5ff080e232ec859d09913c9cd9aae1",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-veo-31-i2v",
    "label": "fal-veo-31-i2v",
    "endpointId": "fal-ai/veo3.1/image-to-video",
    "provider": "fal",
    "schemaSha256": "38de3e7c11d723a257caf2bcd516769c54c61065cc92df334a50df21ae7c5624",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-veo-31-t2v",
    "label": "fal-veo-31-t2v",
    "endpointId": "fal-ai/veo3.1",
    "provider": "fal",
    "schemaSha256": "d2f817bb0bf62c1bb558873d1d9e9a548765659ede6519c85cab56fc40b40f04",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-veo-31-transition",
    "label": "fal-veo-31-transition",
    "endpointId": "fal-ai/veo3.1/first-last-frame-to-video",
    "provider": "fal",
    "schemaSha256": "500aba9b9e87295223bc9018c266d1d8a0c2377311da743a23cadf095d0e171c",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-void-inpaint",
    "label": "fal-void-inpaint",
    "endpointId": "fal-ai/void-video-inpainting",
    "provider": "fal",
    "schemaSha256": "9a56f0642b8a6407cf1382b47821843602f75bb1d24d7e4fc187cd8522e8e723",
    "transport": "queue",
    "priceUsd": 0.0001
  },
  {
    "name": "livepeer-example/fal-whisper-transcribe",
    "label": "fal-whisper-transcribe",
    "endpointId": "fal-ai/whisper",
    "provider": "fal",
    "schemaSha256": "929dd25b4246701e480e31a9e38de7d9589e675fd3d6c35aeedda3e475ddd79b",
    "transport": "queue",
    "priceUsd": 0.0001
  }
] as const;

const byName = new Map(FAL_CAPABILITY_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]));

export function lookupFalCapability(name: string): FalCapabilityCatalogEntry | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return byName.get(needle) ?? null;
}
