import eel
from pyllamacpp.model import Model

# Define the initial prompt context
prompt_context = """Act as Vladimir. Vladimir is helpful, kind, honest,
and never fails to answer the User's requests immediately and with precision. 

User: Hey Vladimir nice to have you here!
Bob: Welcome! I'm here to assist you with anything you need. What can I do for you today?
"""

# Create an instance of the language model
model = Model(
    model_path='C:/Users/marek/AppData/Local/nomic.ai/GPT4All/ggml-v3-13b-hermes-q5_1.bin',
    n_ctx=512,
    prompt_context=prompt_context,
    prompt_prefix="User:",
    prompt_suffix="Vladimir:"
)

# Define a list to store the chat history
chat_history = []

# Initialize Eel and set up the web interface
eel.init('web')

# Expose Python functions to be called from JavaScript
@eel.expose
def get_bob_response(prompt):
    response = ""
    for token in model.generate(
        prompt,
        antiprompt='User:',
        n_threads=6,
        n_batch=1024,
        n_predict=256,
        n_keep=48,
        repeat_penalty=1.0
    ):
        response += token

    chat_history.append((prompt, response))
    return response

@eel.expose
def get_chat_history():
    return chat_history

@eel.expose
def clear_chat_history():
    global chat_history
    chat_history = []

# Start the web interface
eel.start('index.html', size=(800, 600))
