import subprocess, sys
subprocess.check_call([sys.executable, "-m", "spacy", "download", "de_core_news_md"])
subprocess.check_call([sys.executable, "-m", "textblob.download_corpora"])
print("Models downloaded.")
