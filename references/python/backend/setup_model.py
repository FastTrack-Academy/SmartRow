"""Explicit one-time model download. Never downloads or uploads user videos."""
import urllib.request

from .acquisition import MODEL_PATH, MODEL_SHA256, MODEL_URL, file_sha256


def main():
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not MODEL_PATH.exists():
        temporary = MODEL_PATH.with_suffix(".download")
        try:
            print("Downloading the notebook's MediaPipe Heavy model...", flush=True)
            urllib.request.urlretrieve(MODEL_URL, temporary)
            if file_sha256(temporary) != MODEL_SHA256:
                raise RuntimeError("Model checksum differs from the verified project asset; refusing to install it.")
            temporary.replace(MODEL_PATH)
        finally:
            temporary.unlink(missing_ok=True)
    if file_sha256(MODEL_PATH) != MODEL_SHA256:
        raise RuntimeError("Existing model checksum differs from the verified project asset. Inspect the file before replacing it.")
    print(f"Model: {MODEL_PATH}\nSHA-256: {file_sha256(MODEL_PATH)}")


if __name__ == "__main__":
    main()
