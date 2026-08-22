import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

// Django AI service, running locally alongside the Node backend.
const DJANGO_URL = 'http://127.0.0.1:8000';

export async function detectDiseaseFromDjango(imagePath, crop = 'Tomato') {
  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));
    formData.append('crop', crop);

    const response = await axios.post(`${DJANGO_URL}/api/predict/`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      throw new Error(error.response.data.error || error.response.data.message || 'Django API Error');
    }
    throw new Error('Failed to connect to Django AI Service');
  }
}