import os
from google import genai as ggenai
import asyncio

async def test():
    key = "AIzaSyBkP909Z5aHdIlotuyuHsIUheJcm7jK0_A" # From the .env file
    gclient = ggenai.Client(api_key=key)
    try:
        gresp = await gclient.aio.models.generate_content(
            model="gemini-1.5-flash", 
            contents="Ciao, come stai?"
        )
        print("1.5-flash SUCCESS:", gresp.text)
    except Exception as e:
        print("1.5-flash ERROR:", str(e))

    try:
        gresp2 = await gclient.aio.models.generate_content(
            model="gemini-2.5-flash", 
            contents="Ciao, come stai?"
        )
        print("2.5-flash SUCCESS:", gresp2.text)
    except Exception as e:
        print("2.5-flash ERROR:", str(e))
        
    try:
        gresp3 = await gclient.aio.models.generate_content(
            model="gemini-2.0-flash", 
            contents="Ciao, come stai?"
        )
        print("2.0-flash SUCCESS:", gresp3.text)
    except Exception as e:
        print("2.0-flash ERROR:", str(e))

asyncio.run(test())
