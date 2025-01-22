import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import {AppContextProvider} from "./AppContext.tsx";

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"/>
        <AppContextProvider>
            <App/>
        </AppContextProvider>
    </StrictMode>,
)
