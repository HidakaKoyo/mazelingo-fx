import { elements } from "./elements";
import { CUSTOM_MODEL_VALUE, MODEL_OPTIONS, isListedModel } from "./models";
import { getCurrentLang } from "./state";
import { getTranslations } from "./translations";

export interface ModelControl {
  select: HTMLSelectElement;
  input: HTMLInputElement;
}

export function getModelValue(control: Readonly<ModelControl>): string {
  return control.select.value === CUSTOM_MODEL_VALUE
    ? control.input.value.trim()
    : control.select.value;
}

export function getModelControls(): ModelControl[] {
  return [
    { input: elements.customModel0, select: elements.model0 },
    { input: elements.customModel1, select: elements.model1 },
    { input: elements.customModel2, select: elements.model2 },
  ];
}

export function getSelectedModels(): string[] {
  return getModelControls()
    .map((control) => getModelValue(control))
    .filter(Boolean);
}

export function syncCustomModelControl(control: Readonly<ModelControl>): void {
  const isCustom = control.select.value === CUSTOM_MODEL_VALUE;
  control.input.hidden = !isCustom;
  control.input.placeholder = getTranslations(getCurrentLang()).customModelPlaceholder;
}

export function setModelControlValue(control: Readonly<ModelControl>, modelName: string): void {
  if (modelName === "" || isListedModel(modelName)) {
    control.select.value = modelName;
    control.input.value = "";
  } else {
    control.select.value = CUSTOM_MODEL_VALUE;
    control.input.value = modelName;
  }
  syncCustomModelControl(control);
}

export function setModelValues(models: readonly string[]): void {
  getModelControls().forEach((control, index) => {
    setModelControlValue(control, models[index] ?? "");
  });
}

export function populateModelSelects(): void {
  for (const control of getModelControls()) {
    const current = getModelValue(control),
      sel = control.select;
    sel.innerHTML = "";
    for (const opt of MODEL_OPTIONS) {
      const o = document.createElement("option");
      if (typeof opt === "string") {
        o.value = opt;
        o.textContent = opt;
      } else {
        o.value = opt.value;
        o.textContent =
          typeof opt.label === "object" ? (opt.label[getCurrentLang()] ?? opt.label.ja) : opt.label;
      }
      sel.append(o);
    }
    setModelControlValue(control, current);
  }
}
