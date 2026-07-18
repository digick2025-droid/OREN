-- Rebrand : le produit s'appelle désormais OREN (DIGICK reste le nom de l'entreprise).
-- Renomme les libellés d'abonnements affichés (plans.name).
update plans set name = replace(name, 'DIGICK', 'OREN')
where name like 'DIGICK%';
