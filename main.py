
from gpt4all import GPT4All
import eel

eel.init('web')

model = GPT4All(model_name='C:/Users/..../AppData/Local/nomic.ai/GPT4All/llama-2-7b-chat.ggmlv3.q4_0.bin')
chat_history = []

@eel.expose
def get_bob_response(user_input):
    chat_history.append(user_input)
    with model.chat_session() as chat:
        response = chat.generate(prompt=' '.join(chat_history), temp=0)
        return response

@eel.expose
def clear_chat_history():
    chat_history.clear()

eel.start('index.html', size=(500, 600))
