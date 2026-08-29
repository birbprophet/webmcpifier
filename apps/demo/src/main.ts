const form = document.querySelector<HTMLFormElement>("#quote-form");
const review = document.querySelector<HTMLButtonElement>("#review-request");
const dialog = document.querySelector<HTMLDialogElement>("#review-dialog");
const returnToForm = document.querySelector<HTMLButtonElement>("#return-to-form");

if (form === null || review === null || dialog === null || returnToForm === null) {
  throw new Error("Northstar review controls are missing.");
}

review.addEventListener("click", () => {
  if (form.reportValidity()) dialog.showModal();
});

returnToForm.addEventListener("click", () => {
  dialog.close();
  review.focus();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  dialog.close();
  form.setAttribute("data-human-submitted", "true");
});
