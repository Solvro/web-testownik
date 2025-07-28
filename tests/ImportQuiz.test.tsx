import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import '@testing-library/jest-dom';
import AppContext from "../src/AppContext";
import ImportQuizPage from "../src/pages/ImportQuizPage";
import { AppTheme } from "../src/Theme.tsx";

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

global.fetch = vi.fn();

const validQuizData = {
  title: "Szalone Stolice Świata",
  description: "To jest tzw. inteligentny quiz, który sprawdza Twoją wiedzę o niczym.",
  questions: [
    {
      id: 1,
      question: "Jaka jest stolica Burkina Faso?",
      answers: [
        { answer: "Wagadugu", correct: true },
        { answer: "Bamako", correct: false },
        { answer: "Niamey", correct: false },
        { answer: "Ouagadougou", correct: false }
      ],
      multiple: false,
      explanation: "stolica fajna i nietypowa"
    },
    {
      id: 2,
      question: "Które stolice sa tzw. dziwne?",
      answers: [
        { answer: "Tuvalu - Funafuti", correct: true },
        { answer: "Nauru - Yaren", correct: true },
        { answer: "Palau - Ngerulmud", correct: true },
        { answer: "Polska - Warszawa", correct: false }
      ],
      multiple: true,
    },
    {
      id: 3,
      question: "Wybierz najdziwniejsza stolice",
      answers: [
        { answer: "Dżibuti (Djibouti)", correct: true },
        { answer: "Banjul", correct: false },
        { answer: "Malabo", correct: false },
        { answer: "Asmara", correct: false }
      ],
      multiple: false,
      explanation: "Dżibuti to stolica kraju Dzibuti, oki"
    }
  ]
};

const mockAppContext = {
  isGuest: true,
  isAuthenticated: false,
  axiosInstance: { post: vi.fn() },
  theme: new AppTheme(),
  setAuthenticated: vi.fn(),
  setGuest: vi.fn(),
  fetchUserData: vi.fn(),
};

const renderWithContext = (contextValue = mockAppContext) => {
  return render(
    <MemoryRouter>
      <AppContext.Provider value={contextValue as never}>
        <ImportQuizPage />
      </AppContext.Provider>
    </MemoryRouter>
  );
};

describe('ImportQuizPage - JSON Text Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders initial form with JSON text option selected by default', () => {
    renderWithContext();
    
    expect(screen.getByText(/zaimportuj quiz/i)).toBeInTheDocument();
    expect(screen.getByText(/z pliku/i)).toBeInTheDocument();
    expect(screen.getByText(/z linku/i)).toBeInTheDocument();
    expect(screen.getByText(/z tekstu/i)).toBeInTheDocument();
  });

  it('switches to JSON text import mode', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const textButton = screen.getByText(/z tekstu/i);
    await user.click(textButton);
    
    expect(screen.getByPlaceholderText(/wklej quiz/i)).toBeInTheDocument();
  });

  it('successfully imports valid JSON text', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const textButton = screen.getByText(/z tekstu/i);
    await user.click(textButton);
    
    const textArea = screen.getByPlaceholderText(/wklej quiz/i);
    console.log(JSON.stringify(validQuizData));
    fireEvent.change(textArea, { target: { value: JSON.stringify(validQuizData) } });
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/quiz został zaimportowany/i)).toBeInTheDocument();
    });
  });

  it('handles invalid JSON text', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const textButton = screen.getByText(/z tekstu/i);
    await user.click(textButton);
    
    const textArea = screen.getByPlaceholderText(/wklej quiz/i);
    await user.type(textArea, 'invalid json text');
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/błąd.*parsowania.*json/i)).toBeInTheDocument();
    });
  });

  it('handles empty JSON text', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const textButton = screen.getByText(/z tekstu/i);
    await user.click(textButton);
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/wklej quiz/i)).toBeInTheDocument();
    });
  });
});

describe('ImportQuizPage - File Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('switches to file import mode', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const fileButton = screen.getByText(/z pliku/i);
    await user.click(fileButton);
    
    expect(screen.getByText(/plik.*quiz/i)).toBeInTheDocument();
    expect(screen.getByText(/wybierz plik/i)).toBeInTheDocument();
  });

  it('successfully imports valid JSON file', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const fileButton = screen.getByText(/z pliku/i);
    await user.click(fileButton);
    
    const file = new File([JSON.stringify(validQuizData)], 'quiz.json', {
      type: 'application/json',
    });
    
    const mockFileReader = {
      readAsText: vi.fn().mockImplementation(function() {
        setTimeout(() => {
          this.result = JSON.stringify(validQuizData);
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }),
      result: '',
      onload: null as any,
    };
    
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);
    
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { files: [file] } });
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/quiz został zaimportowany/i)).toBeInTheDocument();
    });
  });

  it('handles file import without selecting file', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const fileButton = screen.getByText(/z pliku/i);
    await user.click(fileButton);
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/wybierz plik.*quiz/i)).toBeInTheDocument();
    });
  });
});

describe('ImportQuizPage - Link Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(fetch).mockClear();
  });

  it('switches to link import mode', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const linkButton = screen.getByText(/z linku/i);
    await user.click(linkButton);
    
    expect(screen.getByPlaceholderText(/wklej link/i)).toBeInTheDocument();
  });

  it('successfully imports from valid link', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve(validQuizData),
    } as Response);
    
    const linkButton = screen.getByText(/z linku/i);
    await user.click(linkButton);
    
    const linkInput = screen.getByPlaceholderText(/wklej link/i);
    await user.type(linkInput, 'https://testownik.solvro.pl/quiz/123');
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/quiz został zaimportowany/i)).toBeInTheDocument();
    });
  });

  it('handles invalid link format', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const linkButton = screen.getByText(/z linku/i);
    await user.click(linkButton);
    
    const linkInput = screen.getByPlaceholderText(/wklej link/i);
    await user.type(linkInput, 'invalid-link');
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/link.*niepoprawny/i)).toBeInTheDocument();
    });
  });

  it('handles failed link fetch for guest user', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    
    const linkButton = screen.getByText(/z linku/i);
    await user.click(linkButton);
    
    const linkInput = screen.getByPlaceholderText(/wklej link/i);
    await user.type(linkInput, 'https://external-domain.com/quiz/123');
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/gościem.*domeny.*testownik/i)).toBeInTheDocument();
    });
  });

  it('handles empty link input', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const linkButton = screen.getByText(/z linku/i);
    await user.click(linkButton);

    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/wklej link/i)).toBeInTheDocument();
    });
  });
});

describe('ImportQuizPage - Quiz Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('handles quiz without title', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const invalidQuiz = {
      ...validQuizData,
      title: '',
    };
    
    const textButton = screen.getByText(/z tekstu/i);
    await user.click(textButton);
    
    const textArea = screen.getByPlaceholderText(/wklej quiz/i);
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalidQuiz) } });

    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/podaj tytuł/i)).toBeInTheDocument();
    });
  });

  it('handles quiz without questions', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const invalidQuiz = {
      ...validQuizData,
      questions: [],
    };
    
    const textButton = screen.getByText(/z tekstu/i);
    await user.click(textButton);
    
    const textArea = screen.getByPlaceholderText(/wklej quiz/i);
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalidQuiz) } });
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/dodaj przynajmniej jedno pytanie/i)).toBeInTheDocument();
    });
  });

  it('check if summarization is correct', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const textButton = screen.getByText(/z tekstu/i);
    await user.click(textButton);
    
    const textArea = screen.getByPlaceholderText(/wklej quiz/i);
    fireEvent.change(textArea, { target: { value: JSON.stringify(validQuizData) } });
    
    const importButton = screen.getByText("Zaimportuj");
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/quiz został zaimportowany/i)).toBeInTheDocument();
      
      const correctAnswers = document.querySelectorAll('.list-group-item-success');
      expect(correctAnswers.length).toEqual(5)
 
      const incorrectAnswers = document.querySelectorAll('.list-group-item-danger');
      expect(incorrectAnswers.length).toEqual(7)

      expect(screen.getByText('Wagadugu')).toBeInTheDocument();
      const wagaduguElement = screen.getByText('Wagadugu').closest('.list-group-item');
      expect(wagaduguElement).toHaveClass('list-group-item-success');
      
      expect(screen.getByText('Bamako')).toBeInTheDocument();
      const bamakoElement = screen.getByText('Bamako').closest('.list-group-item');
      expect(bamakoElement).toHaveClass('list-group-item-danger');
    });
  });
});