export async function chooseTheme(page, theme) {
  const picker = page.locator('.theme-picker');
  if (!await picker.evaluate((element) => element.open)) await picker.locator('summary').click();
  await picker.locator(`input[value="${theme}"]`).check();
  await picker.locator('summary').click();
}
