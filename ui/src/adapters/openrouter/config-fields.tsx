import type { AdapterConfigFieldsProps } from "../types";
import {
  DraftInput,
  Field,
  help,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const instructionsFileHint =
  "Absolute path to a markdown file containing stable agent instructions. These are injected into the OpenRouter system prompt at runtime.";

export function OpenRouterConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
  hideInstructionsFile,
}: AdapterConfigFieldsProps) {
  const datalistId = "openrouter-model-options";

  return (
    <>
      {!hideInstructionsFile && (
        <Field label="Agent instructions file" hint={instructionsFileHint}>
          <div className="flex items-center gap-2">
            <DraftInput
              value={
                isCreate
                  ? values!.instructionsFilePath ?? ""
                  : eff(
                      "adapterConfig",
                      "instructionsFilePath",
                      String(config.instructionsFilePath ?? ""),
                    )
              }
              onCommit={(value) =>
                isCreate
                  ? set!({ instructionsFilePath: value })
                  : mark("adapterConfig", "instructionsFilePath", value || undefined)
              }
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}

      <Field label="Model" hint={help.model}>
        <div className="space-y-2">
          <DraftInput
            value={
              isCreate
                ? values!.model
                : eff("adapterConfig", "model", String(config.model ?? ""))
            }
            onCommit={(value) =>
              isCreate
                ? set!({ model: value })
                : mark("adapterConfig", "model", value || undefined)
            }
            immediate
            className={inputClass}
            placeholder="openai/gpt-5"
            list={models.length > 0 ? datalistId : undefined}
          />
          {models.length > 0 && (
            <datalist id={datalistId}>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </datalist>
          )}
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            OpenRouter agents are text-only. Use them for planning, writing, analysis, or coordination. They cannot inspect files, run commands, or edit code through this adapter.
          </div>
        </div>
      </Field>
    </>
  );
}
