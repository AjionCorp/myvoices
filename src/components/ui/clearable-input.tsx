import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ClearableInputProps
  extends React.ComponentProps<typeof Input> {
  onClear?: () => void;
}

/**
 * A shadcn Input that shows an × button whenever the field has a value.
 * Clicking × either calls `onClear` (if provided) or sets the value to ""
 * via a synthetic onChange event.
 */
const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  ({ className, onClear, onChange, value, ...props }, ref) => {
    const hasValue = value !== undefined ? String(value).length > 0 : false;

    function handleClear() {
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: "" },
          currentTarget: { value: "" },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }

    return (
      <div className="relative flex items-center">
        <Input
          ref={ref}
          value={value}
          onChange={onChange}
          className={cn("pr-8", className)}
          {...props}
        />
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tabIndex={-1}
            onClick={handleClear}
            className="absolute right-1 h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
            aria-label="Clear"
          >
            <X size={13} />
          </Button>
        )}
      </div>
    );
  }
);
ClearableInput.displayName = "ClearableInput";

export { ClearableInput };
