import { test, expect, Page } from '@playwright/test';

const QUIZ_TITLE = 'Solvro Rulez';

async function loginAsGuest(page: Page) {
  await page.goto('/');
  
  await page.locator('button', { hasText: /jako gość/i }).click();
  
  const guestDialog = page.locator('#guestModal');
  await expect(guestDialog).toBeVisible();

  const dialogLoginButton = guestDialog.locator('button', { hasText: /jako gość/i });
  await dialogLoginButton.click();
  
  await expect(guestDialog).not.toBeVisible();
}

async function createProperQuiz(page: Page) {
  await page.goto('/create-quiz');

  const titleInput = page.getByPlaceholder(/tytuł quizu/i);
  await titleInput.fill(QUIZ_TITLE);

  const questionContent = page.getByRole('textbox', { name: 'Podaj treść pytania' });
  await questionContent.fill('Czy lubisz Solvro?');

  const answerContent1 = page.getByRole('textbox', { name: 'Treść odpowiedzi' }).first();
  await answerContent1.fill('Tak, uwielbiam Solvro! 😍');

  const correctAnswerCheckbox = page.getByRole('checkbox').first();
  await correctAnswerCheckbox.check();

  const answerContent2 = page.getByRole('textbox', { name: 'Treść odpowiedzi' }).nth(1);
  await answerContent2.fill('Nie, nie lubię Solvro. 😢');

  const saveQuizButton = page.locator('button', { hasText: /stwórz quiz/i });
  await saveQuizButton.click();

  const successMessage = page.getByRole('dialog');
  await expect(successMessage).toBeVisible();
}

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render the home page', async ({ page }) => {
    expect(await page.title()).toMatch(/testownik solvro/i);
    expect(await page.content()).toMatch(/testownik solvro/i);
    await expect(page.locator('button', { hasText: /zaloguj się/i })).toBeVisible();
  });

  test('should allow user to login as a guest', async ({ page }) => {
    await loginAsGuest(page);
  });
});

test.describe('Create quiz', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
    await page.goto('/create-quiz');
  });

  test('should render the create quiz page', async ({ page }) => {
    expect(await page.title()).toMatch(/stwórz quiz/i);
    expect(await page.locator('h1').textContent()).toMatch(/stwórz .* quiz/i);
    expect(await page.getByPlaceholder(/tytuł quizu/i)).toBeVisible();
    expect(await page.getByPlaceholder(/opis quizu/i)).toBeVisible();
    expect(await page.locator('button', { hasText: /dodaj odpowiedź/i })).toBeVisible();
    expect(await page.locator('button', { hasText: /dodaj pytanie/i })).toBeVisible();
    expect(await page.locator('button', { hasText: /stwórz quiz/i })).toBeVisible();
  });

  test('should check if quiz title is not empty', async ({ page }) => {
    await page.locator('button', { hasText: /stwórz quiz/i }).click();
    expect(await page.locator('#container').getByText(/tytuł quizu/i)).toBeVisible();
  });

  test('should check if question content is not empty', async ({ page }) => {
    await page.getByPlaceholder(/tytuł quizu/i).fill('Solvro Rulez');
    await page.locator('button', { hasText: /stwórz quiz/i }).click();
    expect(await page.locator('#container').getByText(/pytanie .* musi mieć treść/i)).toBeVisible();
  });

  test('should check if answer content is not empty', async ({ page }) => {
    await page.getByPlaceholder(/tytuł quizu/i).fill('Solvro Rulez');
    await page.getByRole('textbox', { name: 'Podaj treść pytania' }).fill('Czy lubisz Solvro?');
    await page.locator('button', { hasText: /stwórz quiz/i }).click();
    expect(await page.locator('#container').getByText(/odpowiedź .* musi mieć treść/i)).toBeVisible();
  });

  test('should create a quiz with valid data', async ({ page }) => {
    await createProperQuiz(page);
  });
});

test.describe('Quiz list', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
    await page.goto('/quizzes');
  });

  test('should render the quiz list page', async ({ page }) => {
    expect(await page.title()).toMatch(/twoje quizy/i);
    expect(await page.locator('h1').textContent()).toMatch(/twoje quizy/i);
    expect(await page.locator('button', { hasText: /stwórz quiz/i })).toBeVisible();
  });

  test('should show newly created quiz in the list', async ({ page }) => {
    await createProperQuiz(page);
    await page.goto('/quizzes');
    await expect(page.locator(`text=${QUIZ_TITLE}`)).toBeVisible();
  });

  test('should show quiz details when clicking on a quiz', async ({ page }) => {
    await createProperQuiz(page);
    await page.goto('/quizzes');

    const quiz = page.locator('div.card').first()
    await expect(quiz).toBeVisible();
    await expect(quiz).toContainText(QUIZ_TITLE);

    const openQuizButton = quiz.getByRole('button', { name: /otwórz/i });
    await openQuizButton.click();

    await expect(page).toHaveURL(/\/quiz\/[a-z0-9-]+/);
    await expect(page.getByText(QUIZ_TITLE)).toBeVisible();
  });

  test('should remove a quiz from the list', async ({ page }) => {
    await createProperQuiz(page);
    await page.goto('/quizzes');

    const quiz = page.locator('div.card').first();
    await expect(quiz).toBeVisible();
    await expect(quiz).toContainText(QUIZ_TITLE);

    const removeQuizButton = quiz.getByRole('group').getByRole('button').nth(3);
    page.once('dialog', async dialog => {
      expect(dialog.message()).toMatch(/czy na pewno chcesz usunąć/i);
      await dialog.accept();
    });
    await removeQuizButton.click();

    await expect(page.locator(`text=${QUIZ_TITLE}`)).not.toBeVisible();
  });
});
