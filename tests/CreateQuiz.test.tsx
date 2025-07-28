import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import '@testing-library/jest-dom';
import AppContext from "../src/AppContext";
import CreateQuizPage from "../src/pages/CreateQuizPage";
import { AppTheme } from "../src/Theme.tsx";

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

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
        <CreateQuizPage />
      </AppContext.Provider>
    </MemoryRouter>
  );
};

describe('CreateQuizPage - Adding Questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders initial form with one question', () => {
    renderWithContext();
    
    expect(screen.getByText('Stwórz nowy quiz')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Podaj tytuł quizu')).toBeInTheDocument();
    expect(screen.getByText('Pytania')).toBeInTheDocument();
    expect(screen.getByText(/pytanie 1/i)).toBeInTheDocument();
  });

  it('adds a new question when clicking "Dodaj pytanie"', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const addButton = screen.getByText('Dodaj pytanie');
    await user.click(addButton);
    
    expect(screen.getByText(/pytanie 1/i)).toBeInTheDocument();
    expect(screen.getByText(/pytanie 2/i)).toBeInTheDocument();
  });

  it('adds multiple questions', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const addButton = screen.getByText('Dodaj pytanie');
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);
    
    expect(screen.getByText(/pytanie 1/i)).toBeInTheDocument();
    expect(screen.getByText(/pytanie 2/i)).toBeInTheDocument();
    expect(screen.getByText(/pytanie 3/i)).toBeInTheDocument();
    expect(screen.getByText(/pytanie 4/i)).toBeInTheDocument();
  });

  it('removes a question when clicking remove button', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const addButton = screen.getByText('Dodaj pytanie');
    await user.click(addButton);
    const removeButtons = screen.getAllByText('Usuń pytanie');
    await user.click(removeButtons[0]);

    expect(screen.getByText(/pytanie 2/i)).toBeInTheDocument();
  });

  it('updates form fields correctly', async () => {
    const user = userEvent.setup();
    renderWithContext();
    
    const titleInput = screen.getByPlaceholderText('Podaj tytuł quizu');
    const descriptionInput = screen.getByPlaceholderText('Podaj opis quizu');
    
    await user.type(titleInput, 'Test Quiz Title');
    await user.type(descriptionInput, 'Test description');
    
    expect(titleInput).toHaveValue('Test Quiz Title');
    expect(descriptionInput).toHaveValue('Test description');
  });
});

describe('CreateQuizPage - Creating Quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('handles empty form submission - no title error', async () => {
    const user = userEvent.setup();
    
    renderWithContext();
    
    const submitButton = screen.getByText('Stwórz quiz');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Podaj tytuł quizu/i)).toBeInTheDocument();
    });
  });

  it('handles empty question - no question description error', async () => {
    const user = userEvent.setup();
    
    renderWithContext();
    
    await user.type(screen.getByPlaceholderText('Podaj tytuł quizu'), 'Test Quiz');
    const submitButton = screen.getByText('Stwórz quiz');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/musi mieć treść/i)).toBeInTheDocument();
    });
  });

  it('handles empty question answers - no answer for question', async () => {
    const user = userEvent.setup();
    
    renderWithContext();

    await user.type(screen.getByPlaceholderText(/tytuł quizu/i), 'Test Quiz');
    await user.type(screen.getByPlaceholderText(/treść pytania/i), 'Test description');
    const submitButton = screen.getByText('Stwórz quiz');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/musi mieć treść/i)).toBeInTheDocument();
    });
  });

  // it('handles questions without correct answer', async () => {
  //   const user = userEvent.setup();
    
  //   renderWithContext();
    
  //   await user.type(screen.getByPlaceholderText(/tytuł quizu/i), 'Test Quiz');
  //   await user.type(screen.getByPlaceholderText(/treść pytania/i), 'Test description');
  //   const answerInputs = screen.getAllByPlaceholderText(/treść odpowiedzi/i);
  //   await user.type(answerInputs[0], 'Answer 1');
  //   await user.type(answerInputs[1], 'Answer 2');
  //   const submitButton = screen.getByText('Stwórz quiz');
  //   await user.click(submitButton);
    
  //   await waitFor(() => {
  //     expect(screen.getByText(/prawidłową odpowiedź/i)).toBeInTheDocument();
  //   });
  // });

  it('handles correct creation', async () => {
    const user = userEvent.setup();
    
    renderWithContext();

    await user.type(screen.getByPlaceholderText(/tytuł quizu/i), 'Test Quiz');
    await user.type(screen.getByPlaceholderText(/treść pytania/i), 'Test description');
    const answerInputs = screen.getAllByPlaceholderText(/treść odpowiedzi/i);
    await user.type(answerInputs[0], 'Answer 1');
    await user.type(answerInputs[1], 'Answer 2');
    
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    
    const submitButton = screen.getByText('Stwórz quiz');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Quiz został utworzony/i)).toBeInTheDocument();
    });
  });
});