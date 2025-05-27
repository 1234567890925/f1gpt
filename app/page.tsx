"use client"
import Image from 'next/image'
import f1GPTLogo from "./assets/f1-logo.png"
import { useChat } from "ai/react"
import { Message } from "ai"
import Bubble from "./components/Bubble"
import LoadingBubble from "./components/LoadingBubble"
import PromptSuggestionRow from "./components/PromptSuggestionRow"

const Home = () => {
    const {append, isLoading, input, handleInputChange, handleSubmit, messages} = useChat()
    const noMessages = !messages || messages.length === 0
    const handlePrompt = ( promptText ) => {
        const msg = {
            id: crypto.randomUUID(),
            content: promptText, 
            role: "user"
        }
        append(msg)
    }

    return (
        <main>
            <Image src={f1GPTLogo} width={250} alt="f1 logo" />
            <section className={noMessages ? "" : "populated"}>
                {noMessages ? (
                    <>
                        <p className='starter-text'>
                            Hi, I'm F1gpt!
                        </p>
                        <br/>
                        {<PromptSuggestionRow onPromptClick={handlePrompt}></PromptSuggestionRow>}
                    </>
                ) : (
                    <>
                        {messages.map((message, index) => (
                        <Bubble key={`message-${index}`} message={message} />
                        ))}
                        {isLoading && <LoadingBubble></LoadingBubble>}
                    </>
                )}
            </section>
                <form onSubmit={handleSubmit}>
                    <input className='question-box' onChange={handleInputChange} value={input} placeholder='Ask me a question...'>

                    </input>

                    <input type="submit">
                    
                    </input>
                </form>
        </main>
    )
}
export default Home 