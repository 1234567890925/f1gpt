import PromptSuggestionButton from "@/app/components/PromptSuggestionButton"
const PromptSuggestionRow = ({onPromptClick}) => {
    const prompts = [
        "who is toto wolf?",
        "Is max a 4 time world champion?"
    ]
    return (
        <div className="prompt-suggestion-row">
            {prompts.map((prompt, index) => <PromptSuggestionButton
                key={`suggestion-${index}`}
                text={prompt}
                onClick={() => onPromptClick(prompt)}
            />)}
        </div>
    )
}

export default PromptSuggestionRow