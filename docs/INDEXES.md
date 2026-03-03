Firestore indexes for Orders and Products

Suggested indexes to support the API queries efficiently. After deploying, Firestore may prompt for these; you can pre-create them via the Firebase Console or CLI.

Orders
- Query: supplierIds array-contains + orderBy createdAt desc
  - Collection: orders
  - Fields:
    - supplierIds: array-contains
    - createdAt: desc
    - __name__: asc (added automatically)

- Query: customerId == ... + orderBy createdAt desc
  - Collection: orders
  - Fields:
    - customerId: asc
    - createdAt: desc
    - __name__: asc

Products
- Query: supplierId == ... + orderBy updatedAt desc
  - Collection: products
  - Fields:
    - supplierId: asc
    - updatedAt: desc
    - __name__: asc

Notes
- Firestore automatically suggests index creation with a direct link when a missing index is encountered. Use those links if your sort/filter combo differs.
- For cursor pagination that uses createdAt or updatedAt plus __name__, the index should include the orderBy field; __name__ ordering is implicit.

