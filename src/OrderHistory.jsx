import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OrderHistory({ onLogout, onHome, brandName, userType }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [viewingDetails, setViewingDetails] = useState(false);
  const navigate = useNavigate();

useEffect(() => {
  document.title = `${distributor} - Order History`;
}, [distributor]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      setOrders(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

  const viewOrderDetails = async (orderId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}/items`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch order items');
      }
      
      const data = await response.json();
      
      // Find the order
      const order = orders.find(o => o.id === orderId);
      setSelectedOrder(order);
      setOrderItems(data);
      setViewingDetails(true);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order details:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const goBack = () => {
    if (viewingDetails) {
      setViewingDetails(false);
      setSelectedOrder(null);
      setOrderItems([]);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {brandName || 'Feather Storefront'} - {viewingDetails ? `Order #${selectedOrder?.id} Details` : 'Order History'}
        </h1>
        <div className="flex gap-2">
          <button onClick={goBack} className="px-3 py-1 bg-gray-400 text-white rounded">
            {viewingDetails ? 'Back to Orders' : 'Home'}
          </button>
          <button onClick={onHome} className="px-3 py-1 bg-blue-500 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : viewingDetails ? (
        <div>
          <div className="bg-gray-100 p-4 rounded mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="font-medium">{formatDate(selectedOrder.order_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium">{selectedOrder.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium">
                  <span className={`px-2 py-1 rounded text-xs ${
                    selectedOrder.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 
                    selectedOrder.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' : 
                    selectedOrder.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedOrder.status}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {orderItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No items found for this order.</p>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orderItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {item.image_url && (
                              <div className="flex-shrink-0 h-10 w-10 mr-4">
                                <img className="h-10 w-10 rounded object-cover" src={item.image_url} alt={item.name} />
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{item.sku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.quantity}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">${item.unit_price.toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">${(item.quantity * item.unit_price).toFixed(2)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-right font-medium">
                        Order Total:
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold">
                        ${selectedOrder.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl mb-4">No orders found</p>
          <button 
            onClick={() => navigate('/storefront')}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(order.order_date)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.customer_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">${order.total_amount.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 
                      order.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' : 
                      order.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => viewOrderDetails(order.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}