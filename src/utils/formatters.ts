export function formatCpfCnpj(value: string) {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
        // CPF: 000.000.000-00
        return v
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        // CNPJ: 00.000.000/0000-00
        return v
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .slice(0, 18);
    }
}

export function formatPhone(value: string) {
    const v = value.replace(/\D/g, '');
    if (v.length <= 10) {
        return v
            .replace(/^(\d{2})(\d)/g, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .slice(0, 14);
    } else {
        return v
            .replace(/^(\d{2})(\d)/g, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .slice(0, 15);
    }
}

export function formatCep(value: string) {
    const v = value.replace(/\D/g, '');
    return v
        .replace(/^(\d{5})(\d)/, '$1-$2')
        .slice(0, 9);
}
