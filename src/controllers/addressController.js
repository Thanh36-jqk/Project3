const prisma = require('../config/postgres');

exports.getAddresses = async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId: req.user.id },
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }]
        });
        res.status(200).json(addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createAddress = async (req, res) => {
    try {
        const { label, fullName, phone, address, isDefault } = req.body;
        if (!fullName || !phone || !address) {
            return res.status(400).json({ message: 'fullName, phone, and address are required' });
        }
        if (isDefault) {
            await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
        }
        const newAddress = await prisma.address.create({
            data: { userId: req.user.id, label: label || 'Home', fullName, phone, address, isDefault: !!isDefault }
        });
        res.status(201).json(newAddress);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { label, fullName, phone, address, isDefault } = req.body;
        const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        if (!existing) return res.status(404).json({ message: 'Address not found' });

        if (isDefault) {
            await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
        }
        const updated = await prisma.address.update({
            where: { id: req.params.id },
            data: {
                ...(label !== undefined && { label }),
                ...(fullName !== undefined && { fullName }),
                ...(phone !== undefined && { phone }),
                ...(address !== undefined && { address }),
                ...(isDefault !== undefined && { isDefault: !!isDefault })
            }
        });
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        if (!existing) return res.status(404).json({ message: 'Address not found' });
        await prisma.address.delete({ where: { id: req.params.id } });
        res.status(200).json({ message: 'Address deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.setDefaultAddress = async (req, res) => {
    try {
        const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        if (!existing) return res.status(404).json({ message: 'Address not found' });
        await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
        const updated = await prisma.address.update({ where: { id: req.params.id }, data: { isDefault: true } });
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
