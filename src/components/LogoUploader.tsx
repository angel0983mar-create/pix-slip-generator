import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LogoUploaderProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
}

export function LogoUploader({ value, onChange, className = "" }: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).");
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionar suavemente se for muito grande para não pesar o armazenamento
        const maxDimension = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onChange(e.target?.result as string);
          setLoading(false);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/png");
        onChange(compressedDataUrl);
        setLoading(false);
        toast.success("Logo carregado com sucesso!");
      };
      img.onerror = () => {
        onChange(e.target?.result as string);
        setLoading(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      toast.error("Falha ao ler o arquivo de imagem.");
      setLoading(false);
    };
    reader.readAsDataURL(file);

    // Reset input so user can choose the same file again if wanted
    event.target.value = "";
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
          <img
            src={value}
            alt="Logo da loja"
            className="size-14 rounded-lg border border-border object-contain bg-background"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Logo configurada</p>
            <p className="text-[11px] text-muted-foreground truncate">
              Arquivo salvo diretamente neste aparelho
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-8"
              disabled={loading}
            >
              Trocar arquivo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(null)}
              title="Remover logo"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-secondary/20 p-5 text-center transition-colors hover:border-primary/60 hover:bg-secondary/40"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Upload className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {loading ? "Carregando imagem..." : "Clique para escolher a logo (arquivo)"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              PNG, JPG ou WEBP do seu computador ou celular (sem precisar de link)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
