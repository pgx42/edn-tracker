import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoke } from "@tauri-apps/api/core";

const DOC_TYPES = [
  { value: "college", label: "Collège - Cours/support de cours" },
  { value: "poly", label: "Polycopié - Support pédagogique" },
  { value: "lca", label: "LCA - Lecture critique d'article" },
  { value: "annale", label: "Annale - Exam ou QCM" },
  { value: "lisa", label: "Fiche LISA - Fiche de synthèse LISA" },
  { value: "other", label: "Autre - Non catégorisé" },
];

interface Specialty {
  id: string;
  name: string;
}

interface Item {
  id: number;
  specialty_id: string;
  code: string;
  title: string;
  description?: string;
  rank: string;
}

interface PdfImportModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (docType: string, specialtyId?: string, itemId?: number) => void;
  isLoading?: boolean;
}

export function PdfImportModal({
  open,
  onCancel,
  onConfirm,
  isLoading = false,
}: PdfImportModalProps) {
  const [docType, setDocType] = React.useState<string>("other");
  const [selectedSpecialty, setSelectedSpecialty] = React.useState<string>("");
  const [selectedItem, setSelectedItem] = React.useState<string>("");
  const [specialties, setSpecialties] = React.useState<Specialty[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);

  // Load specialties on mount
  React.useEffect(() => {
    if (!open) return;
    loadSpecialties();
  }, [open]);

  // Load items when specialty changes (for college type)
  React.useEffect(() => {
    if (!selectedSpecialty) {
      setItems([]);
      return;
    }
    loadItems(selectedSpecialty);
  }, [selectedSpecialty]);

  const loadSpecialties = async () => {
    try {
      setLoadingData(true);
      const specs = await invoke<Specialty[]>("get_specialties");
      setSpecialties(specs);
    } catch (err) {
      console.error("Failed to load specialties:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadItems = async (specialtyId: string) => {
    try {
      const itemList = await invoke<Item[]>("get_items", { specialty_id: specialtyId });
      setItems(itemList);
    } catch (err) {
      console.error("Failed to load items:", err);
    }
  };

  const handleConfirm = () => {
    if (docType === "college" && !selectedSpecialty) {
      return; // Require specialty for college
    }
    if (["poly", "lca", "annale"].includes(docType) && !selectedItem) {
      return; // Require item for these types
    }

    const itemId = selectedItem ? parseInt(selectedItem) : undefined;
    onConfirm(docType, selectedSpecialty, itemId);
  };

  const requiresSpecialty = docType === "college";
  const requiresItem = ["poly", "lca", "annale"].includes(docType);
  const canConfirm = !isLoading && (!requiresSpecialty || !!selectedSpecialty) && (!requiresItem || !!selectedItem);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onCancel();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importer un PDF</DialogTitle>
          <DialogDescription>
            Sélectionnez le type de document et les informations associées
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Document type selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Type de document</Label>
            <RadioGroup value={docType} onValueChange={(value) => {
              setDocType(value);
              setSelectedSpecialty("");
              setSelectedItem("");
            }}>
              <div className="space-y-3">
                {DOC_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={type.value} id={type.value} />
                    <Label htmlFor={type.value} className="font-normal cursor-pointer flex-1">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Specialty selection for college */}
          {requiresSpecialty && (
            <div>
              <Label htmlFor="specialty-select" className="text-sm font-semibold">
                Matière / Spécialité *
              </Label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger id="specialty-select" className="mt-2">
                  <SelectValue placeholder="Sélectionner une matière..." />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((spec) => (
                    <SelectItem key={spec.id} value={spec.id}>
                      {spec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Item selection for poly/lca/annale */}
          {requiresItem && (
            <div>
              <Label htmlFor="item-select" className="text-sm font-semibold">
                Item / Sujet associé *
              </Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger id="item-select" className="mt-2">
                  <SelectValue placeholder="Sélectionner un item..." />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.code} - {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isLoading || loadingData}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isLoading ? "Import en cours..." : "Suivant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
