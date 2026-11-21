from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
APP = ROOT/'app/GPT-SoVITS-20250606v2pro'

def patch(rel, old, new):
    path = APP/rel
    text = path.read_text(encoding='utf-8')
    if new and new in text:
        return
    if text.count(old) != 1:
        raise RuntimeError(f'Unexpected upstream content in {rel}')
    path.write_text(text.replace(old,new), encoding='utf-8')

# This installation has explicitly provisioned local assets and uses CPU G2PW.
path = APP/'GPT_SoVITS/text/g2pw/onnx_api.py'
text = path.read_text(encoding='utf-8')
sub = 'def download_and_decompress(model_dir: str = "G2PWModel/"):\n    if not os.path.isfile(os.path.join(model_dir, "g2pW.onnx")):\n        raise FileNotFoundError(f"Install the local G2PW asset at {model_dir}; network downloads are disabled")\n    return model_dir\n\n\n'
pattern = r'def download_and_decompress\(.*?(?=class G2PWOnnxConverter)'
if 'network downloads are disabled' not in text:
    text, count = re.subn(pattern, sub, text, count=1, flags=re.S)
    if count != 1 or 'class G2PWOnnxConverter' not in text:
        raise RuntimeError('Unexpected G2PW source')
    path.write_text(text, encoding='utf-8')
patch('GPT_SoVITS/text/g2pw/onnx_api.py', '["CUDAExecutionProvider", "CPUExecutionProvider"]', '["CPUExecutionProvider"]')
# Set the TTS-specific lightweight smoke/health contract after weights load.
patch('api_v2.py', 'APP = FastAPI()',
      'APP = FastAPI()\n\n\n@APP.get("/conduit-health")\ndef conduit_health():\n'
      '    return {"engine": "GPT-SoVITS", "release": "20250606v2pro", "model": tts_pipeline.configs.version,\n'
      '            "device": str(tts_pipeline.configs.device), "fp16": tts_pipeline.configs.is_half}')

# Keep optional plotting, Gradio helpers, and v3 vocoder imports on their own paths.
patch('GPT_SoVITS/AR/modules/lr_schedulers.py',
      '\nfrom matplotlib import pyplot as plt\n', '\n# matplotlib only needed for the diagnostic main below.\n')
patch('GPT_SoVITS/AR/modules/lr_schedulers.py',
      'if __name__ == "__main__":\n    m = nn.Linear',
      'if __name__ == "__main__":\n    from matplotlib import pyplot as plt\n\n    m = nn.Linear')
patch('tools/my_utils.py', 'import gradio as gr\nimport numpy as np\nimport pandas as pd', '# Keep UI and pandas out of the API import path.\nimport numpy as np')
patch('tools/my_utils.py',
      'def check_for_existance(file_list: list = None, is_train=False, is_dataset_processing=False):\n    files_status',
      'def check_for_existance(file_list: list = None, is_train=False, is_dataset_processing=False):\n    import gradio as gr\n\n    files_status')
patch('tools/my_utils.py',
      'def check_details(path_list=None, is_train=False, is_dataset_processing=False):\n    if is_dataset_processing:',
      'def check_details(path_list=None, is_train=False, is_dataset_processing=False):\n    import gradio as gr\n\n    if is_dataset_processing:')
patch('tools/my_utils.py', '        df = pd.read_csv(', '        import pandas as pd\n\n        df = pd.read_csv(')
patch('GPT_SoVITS/TTS_infer_pack/TTS.py', '\nfrom BigVGAN.bigvgan import BigVGAN\n', '\n# Load the optional v3 vocoder only when its branch is used.\n')
patch('GPT_SoVITS/TTS_infer_pack/TTS.py',
      '            self.vocoder = BigVGAN.from_pretrained(',
      '            from BigVGAN.bigvgan import BigVGAN\n\n            self.vocoder = BigVGAN.from_pretrained(')
