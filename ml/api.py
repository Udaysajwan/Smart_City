from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title='Smart City ML API')

class PredictRequest(BaseModel):
    sensor_values: list[float] | None = None

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.post('/predict')
async def predict(req: PredictRequest):
    # Dummy prediction — replace with your model logic
    return { 'prediction': 'no_model_installed', 'input_len': len(req.sensor_values or []) }
