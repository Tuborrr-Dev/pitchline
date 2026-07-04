# for now we use gemini as our AI annotator using the free version of the gemini API.
# In the future we will use our own AI model for annotation
import os

from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# now we create the function that will generate the annotation using the gemini API
def generate_annotation(prompt: str):

    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)

    return response.text
