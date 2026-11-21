"""Prepare TaiMECS clips from the official, human-labelled archive files."""
import json
from pathlib import Path
import subprocess
import wave

from generate import ROOT, BIN, atomic_json
from samples import read_lines

FOLDER = ROOT/'ref/taimecs'
SOURCE = FOLDER/'source'
LABEL = '臺灣華語（TaiMECS 暫用）'


def main():
    src = {r['file_name']:r for r in read_lines(SOURCE/'metadata.jsonl') if r['source']=='human'}
    profile = {'label': LABEL, 'sourceRevision':'83f397e41840ba187cc6833e1320bd2e5fa858f1'}
    clips = [('calm','010.mp3')]
    for mood, name in clips:
        audio = FOLDER/(mood+'.wav')
        transcript = FOLDER/(mood+'.txt')
        subprocess.run([str(BIN/'ffmpeg.exe'), '-hide_banner', '-loglevel','error','-nostdin',
                        '-y','-i',str(SOURCE/name),'-vn','-ac','1','-ar','32000',
                        '-c:a','pcm_s16le',str(audio)],check=True)
        with wave.open(str(audio),'rb') as f:
            duration = f.getnframes()/f.getframerate()
            assert 5 <= duration <= 8, duration
        transcript.write_text(src[name]['text']+'\n', encoding='utf-8')
        profile[mood] = {'audio':audio.name,'transcript':transcript.name,
                         'source':name,'seconds':round(duration,3)}
    atomic_json(FOLDER/'voice.json',profile)
    print(profile)


if __name__=='__main__':
    main()
