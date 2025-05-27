import './global.css';
export const metadata = {
    title: "F1GPT",
    description: "F1 questions go here"
}

const RootLayout = ({ children }) => {
    return (
        <html lang='en'>
            <body>
                {children}
            </body>
        </html>
    )
}

export default RootLayout 