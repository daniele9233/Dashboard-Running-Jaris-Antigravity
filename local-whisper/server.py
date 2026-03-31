import os
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import time
import shutil
import tempfile

app = FastAPI(title="Jarvis Local Whisper RTX 4080 Super")

# CORS to allow requests from the React frontend (localhost:3000 or the Render URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # We allow everything to make it easy for the phone on wifi too
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None

@app.on_event("startup")
def load_model():
    global model
    print("[JARVIS LOCAL WHISPER] Loading model large-v3-turbo on CUDA...")
    start_time = time.time()
    try:
        # device="cuda" ensures RTX 4080 is used
        # compute_type="float16" takes advantage of Tensor Cores for huge speedups
        model = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")
        print(f"[JARVIS LOCAL WHISPER] Model loaded in {time.time() - start_time:.2f}s!")
    except Exception as e:
        print(f"[JARVIS LOCAL WHISPER] Error loading CUDA model: {e}")
        print("[JARVIS LOCAL WHISPER] Falling back to CPU... (This might be slow!)")
        model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")

@app.get("/status")
def status():
    return {"status": "ok", "message": "JARVIS LOCAL WHISPER IS ONLINE"}

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    global model
    if not model:
        raise HTTPException(status_code=500, detail="Model not loaded yet.")

    # Create a temporary file to save the uploaded audio
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
    try:
        with open(temp_file.name, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        start_time = time.time()
        # Transcribe with language set to Italian for maximum reliability
        segments, info = model.transcribe(temp_file.name, language="it", beam_size=5)
        
        # Generator to list
        transcribed_text = " ".join([segment.text for segment in segments]).strip()
        elapsed = time.time() - start_time
        
        print(f"[JARVIS] Transcribed in {elapsed:.3f}s: {transcribed_text}")
        return {"text": transcribed_text, "time_ms": int(elapsed * 1000)}
    
    except Exception as e:
        print(f"[JARVIS] Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        temp_file.close()
        try:
            os.unlink(temp_file.name)
        except Exception:
            pass

if __name__ == "__main__":
    print("Starting Jarvis Local Whisper Server on port 9000...")
    uvicorn.run("server:app", host="0.0.0.0", port=9000, reload=True)
