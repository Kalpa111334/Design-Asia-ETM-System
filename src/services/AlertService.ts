import Swal from 'sweetalert2';

export type AlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

export class AlertService {
	static async confirm(options: { title: string; text?: string; confirmText?: string; cancelText?: string; icon?: AlertIcon }) {
		const result = await Swal.fire({
			title: options.title,
			text: options.text,
			icon: options.icon ?? 'question',
			showCancelButton: true,
			confirmButtonText: options.confirmText ?? 'Yes',
			cancelButtonText: options.cancelText ?? 'Cancel',
			confirmButtonColor: '#2563eb',
			cancelButtonColor: '#6b7280'
		});
		return result.isConfirmed;
	}

	static async success(title: string, text?: string) {
		return Swal.fire({ title, text, icon: 'success', confirmButtonColor: '#16a34a' });
	}

	static async error(title: string, text?: string) {
		return Swal.fire({ title, text, icon: 'error', confirmButtonColor: '#dc2626' });
	}

	static async info(title: string, text?: string) {
		return Swal.fire({ title, text, icon: 'info', confirmButtonColor: '#2563eb' });
	}

	static async warning(title: string, text?: string) {
		return Swal.fire({ title, text, icon: 'warning', confirmButtonColor: '#f59e0b' });
	}
}
