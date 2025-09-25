# JobForm Component

A fully responsive, reusable form component for creating and editing jobs in the Design Asia ETM System.

## Features

- ✅ **Fully Mobile Responsive** - Optimized for all screen sizes
- ✅ **Dual Layout System** - Cards on mobile, table on desktop
- ✅ **Material Management** - Add, edit, and remove materials with auto-calculations
- ✅ **Form Validation** - Built-in validation for required fields
- ✅ **Touch Optimized** - Large touch targets and mobile-friendly interactions
- ✅ **Accessible** - Proper labels, focus states, and keyboard navigation
- ✅ **Reusable** - Can be used in modals, pages, or any container

## Usage

### Basic Usage

```tsx
import JobForm from '../../components/forms/JobForm';

function MyComponent() {
  const handleSubmit = (formData) => {
    console.log('Job data:', formData);
    // Handle form submission
  };

  const handleCancel = () => {
    console.log('Form cancelled');
    // Handle form cancellation
  };

  return (
    <JobForm
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      loading={false}
      submitButtonText="Create Job"
      title="Create New Job"
    />
  );
}
```

### With Modal

```tsx
import JobForm from '../../components/forms/JobForm';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Create Job
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <JobForm
              onSubmit={handleSubmit}
              onCancel={() => setShowModal(false)}
              loading={loading}
              submitButtonText="Create Job"
            />
          </div>
        </div>
      )}
    </>
  );
}
```

### With Initial Data (Edit Mode)

```tsx
<JobForm
  initialData={{
    customer_name: "ABC Company",
    contact_number: "+1234567890",
    sales_person: "John Doe",
    start_date: "2024-01-01",
    completion_date: "2024-01-31",
    contractor_name: "Contractor ABC",
    description: "Building construction project",
    materials_issued: [
      {
        name: "Cement",
        date: "2024-01-01",
        description: "High quality cement",
        quantity: 100,
        rate: 1500,
        amount: 150000
      }
    ]
  }}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  loading={false}
  submitButtonText="Update Job"
  title="Edit Job"
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onSubmit` | `(data: JobFormData) => void` | ✅ | - | Callback when form is submitted |
| `onCancel` | `() => void` | ✅ | - | Callback when form is cancelled |
| `loading` | `boolean` | ❌ | `false` | Loading state for submit button |
| `submitButtonText` | `string` | ❌ | `'Create Job'` | Text for submit button |
| `title` | `string` | ❌ | `'Create New Job'` | Title for the form |
| `initialData` | `Partial<JobFormData>` | ❌ | `{}` | Initial form data for editing |

## Form Data Structure

```typescript
interface JobFormData {
  customer_name: string;
  contact_number: string;
  sales_person: string;
  start_date: string;
  completion_date: string;
  contractor_name: string;
  description: string;
  materials_issued: Material[];
}

interface Material {
  name: string;
  date: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number; // Auto-calculated: quantity * rate
}
```

## Mobile Responsive Features

### Mobile Layout (< 640px)
- **Card-based materials**: Each material in its own card
- **Larger touch targets**: 44px minimum touch area
- **Full-width buttons**: Easier to tap
- **Optimized spacing**: Better use of screen space
- **Stacked form fields**: Single column layout

### Desktop Layout (≥ 640px)
- **Table-based materials**: Traditional table layout
- **Two-column form**: Better space utilization
- **Compact buttons**: Standard desktop sizing
- **Side-by-side actions**: Efficient horizontal layout

### Responsive Breakpoints
- **Mobile**: `< 640px` (sm breakpoint)
- **Tablet**: `640px - 1024px` (sm to lg)
- **Desktop**: `> 1024px` (lg and above)

## Accessibility Features

- **Proper labels**: All inputs have associated labels
- **Focus states**: Clear focus indicators
- **Keyboard navigation**: Full keyboard support
- **Screen reader support**: Proper ARIA attributes
- **Touch optimization**: Large touch targets on mobile
- **Color contrast**: Meets WCAG guidelines

## Styling

The component uses Tailwind CSS classes and follows the design system:

- **Colors**: Indigo primary, gray neutrals
- **Typography**: Responsive font sizes
- **Spacing**: Consistent spacing scale
- **Borders**: Rounded corners and subtle shadows
- **Transitions**: Smooth hover and focus effects

## Examples

See `JobFormDemo.tsx` for complete usage examples including:
- Inline form usage
- Modal form usage
- Form with initial data
- Loading states
- Error handling

## Dependencies

- React 18+
- Tailwind CSS
- Heroicons (for icons)
- TypeScript

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)
