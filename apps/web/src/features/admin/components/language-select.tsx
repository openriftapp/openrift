import { SimpleSelect } from "@/components/ui/simple-select";
import { useLanguageList } from "@/hooks/use-enums";

export interface LanguageSelectOption {
  code: string;
  name: string;
}

interface LanguageSelectProps {
  value: string;
  onChange: (code: string) => void;
  languages?: readonly LanguageSelectOption[];
  exclude?: readonly string[];
  label?: string;
  placeholder?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function LanguageSelect(props: LanguageSelectProps) {
  return props.languages === undefined ? (
    <CatalogLanguageSelect {...props} />
  ) : (
    <LanguageSelectList {...props} languages={props.languages} />
  );
}

function CatalogLanguageSelect(props: LanguageSelectProps) {
  const languages = useLanguageList();
  return <LanguageSelectList {...props} languages={languages} />;
}

function LanguageSelectList({
  value,
  onChange,
  languages,
  exclude = [],
  label,
  placeholder,
  size,
  disabled,
  className,
  id,
}: LanguageSelectProps & { languages: readonly LanguageSelectOption[] }) {
  const items = languages
    .filter((language) => !exclude.includes(language.code))
    .map((language) => ({ value: language.code, label: language.name }));
  return (
    <SimpleSelect
      items={items}
      value={value === "" ? null : value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      size={size}
      disabled={disabled}
      className={className}
      id={id}
    />
  );
}
