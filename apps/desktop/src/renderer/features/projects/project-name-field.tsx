import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface ProjectNameFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const MIN_LENGTH = 2;

function validate(name: string): string | undefined {
  if (!name.trim()) return '项目名称不能为空';
  if (name.trim().length < MIN_LENGTH) return `项目名称至少${MIN_LENGTH}个字符`;
  return undefined;
}

export function ProjectNameField({ value, onChange }: ProjectNameFieldProps) {
  const [touched, setTouched] = useState(false);
  const error = touched ? validate(value) : undefined;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );

  return (
    <Input
      label="项目名称"
      placeholder="请输入项目名称"
      value={value}
      onChange={handleChange}
      onBlur={() => setTouched(true)}
      error={error}
      maxLength={100}
      aria-required="true"
    />
  );
}
