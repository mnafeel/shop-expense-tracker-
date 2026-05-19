export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface AppSettings {
  itemCategories: Category[];
  labourCategories: Category[];
}

export interface BillItem {
  id: string;
  itemName: string;
  price: number;
  categoryId: string;
}

export interface ItemBill {
  id: string;
  shopName: string;
  savedAt: string;
  updatedAt: string;
  items: BillItem[];
}

export interface LabourEntry {
  id: string;
  description: string;
  amount: number;
  addedAt: string;
  categoryId: string;
}

export interface AppData {
  itemBills: ItemBill[];
  labour: LabourEntry[];
  settings: AppSettings;
}
